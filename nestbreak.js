var http = require('http');
var https = require('https');
var url = require('url');
var querystring = require('querystring');
var fs = require('fs');
var oauth = require('oauth').OAuth;
var settings = require('./settings').settings;

function copy(source, destination) {
    for (var item in source)
        if (source.hasOwnProperty(item))
            destination[item] = source[item];

    return destination;
}

function getUserByUsername(username) {
    for (var i = settings.users.length - 1; i >= 0; i--)
        if (settings.users[i].username.toLowerCase() === username.toLowerCase())
            return settings.users[i];
    
    return null;
}

function getUserByAccessToken(access_token) {
    for (var i = settings.users.length - 1; i >= 0; i--)
        if (settings.users[i].access_token === access_token)
            return settings.users[i];
    
    return null;
}

function parseAuthorizationHeader(header) {
    var header = header.substr('OAuth '.length);
    var pattern = /(?:, )?(.*?)="(.*?)"/g;
    var result = {};
    var match;

    while ((match = pattern.exec(header)) !== null)
        result[match[1]] = match[2];

    return result;
}

function createAuthorizationHeader(params) {
    var result = '';

    for (var param in params) {
        if (!params.hasOwnProperty(param))
            continue;

        if (result.length > 0)
            result += ', ';

        result += querystring.escape(param) + '="' + querystring.escape(params[param]) + '"';
    }

    return 'OAuth ' + result;
}

function generateOAuthSignature(method, requestUrl, oauthParams, bodyParams, queryParams) {
    var params = {};
    copy(oauthParams, params);
    copy(bodyParams, params);
    copy(queryParams, params);

    var oa = new oauth(null, null, settings.app.consumer_key, settings.app.consumer_secret, "1.0", null, oauthParams['oauth_signature_method']);
    var user = getUserByAccessToken(oauthParams.oauth_token);

    return oa._getSignature(method, requestUrl, oa._normaliseRequestParams(params), user.access_token_secret);
}

function generateAuthorizationHeader(request, body, requestUrl) {
    var oauthParams = parseAuthorizationHeader(request.headers['authorization']);
    var bodyParams = querystring.parse(body);
    var queryParams = url.parse(request.url, true).query;

    delete oauthParams['oauth_signature'];
    oauthParams['oauth_consumer_key'] = settings.app.consumer_key;
    oauthParams['oauth_signature'] = generateOAuthSignature(request.method, requestUrl, oauthParams, bodyParams, queryParams);

    return createAuthorizationHeader(oauthParams);
}

var requestListener = function(inRequest, inResponse) {
    var inRequestBody = '';

    inRequest.on('data', function(chunk) {
        inRequestBody += chunk;
    });

    inRequest.on('end', function() {
        if (inRequest.method === 'POST' && inRequest.url === '/oauth/access_token') {
            var params = querystring.parse(inRequestBody);
            var user = getUserByUsername(params.x_auth_username);

            if (user === null || user.password !== params.x_auth_password) {
                inResponse.writeHead(401);
                inResponse.end();
                return;
            }

            var response = {
                oauth_token: user.access_token,
                oauth_token_secret: user.access_token_secret,
            };

            inResponse.setHeader('content-type', 'application/x-www-form-urlencoded');
            inResponse.write(querystring.stringify(response));
            inResponse.end();
        }
        else {
            var baseUrl = 'https://api.twitter.com';
            var newUrl = url.parse(baseUrl + inRequest.url);

            var outHeaders = copy(inRequest.headers, {});
            outHeaders['host'] = newUrl.hostname;

            if (outHeaders['authorization'])
                outHeaders['authorization'] = generateAuthorizationHeader(inRequest, inRequestBody, url.format(newUrl));

            var options = {
                host: newUrl.host,
                port: newUrl.port || 443,
                path: newUrl.path,
                method: inRequest.method,
                headers: outHeaders,
            };

            var outRequest = https.request(options, function(outResponse) {
                console.log(outResponse.statusCode + ' ' + inRequest.method + ' ' + inRequest.url);

                inResponse.writeHead(outResponse.statusCode, outResponse.headers);
                outResponse.pipe(inResponse);
            });

            outRequest.write(inRequestBody);
            outRequest.end();
        }
    });
};

http.createServer(requestListener).listen(8080);
