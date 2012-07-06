var http = require('http');
var url = require('url');
var querystring = require('querystring');
var oauth = require('./oauth').OAuth;
var settings = require('./settings').settings;

function copy(source, destination) {
    for (var item in source)
        if (source.hasOwnProperty(item))
            destination[item] = source[item];

    return destination;
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

    var consumerSecret = settings.oauth.secret_key;
    var signatureMethod = oauthParams['oauth_signature_method'];
    var tokenSecret = '';

    return new oauth(consumerSecret, signatureMethod).getSignature(method, requestUrl, params, tokenSecret);
}

function generateAuthorizationHeader(request, body, requestUrl) {
    var oauthParams = parseAuthorizationHeader(request.headers['authorization']);
    var bodyParams = querystring.parse(body);
    var queryParams = url.parse(request.url, true).query;

    delete oauthParams['oauth_signature'];
    oauthParams['oauth_consumer_key'] = settings.oauth.consumer_key;
    oauthParams['oauth_signature'] = generateOAuthSignature(request.method, requestUrl, oauthParams, bodyParams, queryParams);

    return createAuthorizationHeader(oauthParams);
}

var requestListener = function(inRequest, inResponse) {
    var inRequestBody = '';

    inRequest.on('data', function(chunk) {
        inRequestBody += chunk;
    });

    inRequest.on('end', function() {
        console.log();
        console.log('=== Original Request ===');
        console.log(inRequest.method + ' ' + inRequest.url);
        console.log(inRequest.headers);
        console.log(inRequestBody);

        var baseUrl = 'https://api.twitter.com';
        var newUrl = url.parse(baseUrl + inRequest.url);

        var newHeaders = copy(inRequest.headers, {});
        newHeaders['host'] = newUrl.hostname;
        newHeaders['authorization'] = generateAuthorizationHeader(inRequest, inRequestBody, url.format(newUrl));
        delete newHeaders['accept-encoding'];

        console.log();
        console.log('=== New Request ===');
        console.log(inRequest.method + ' ' + newUrl.path);
        console.log(newHeaders);
        console.log(inRequestBody);

        var client = http.createClient(newUrl.port || 80, newUrl.hostname);
        var outRequest = client.request(inRequest.method, newUrl.path || '/', newHeaders);
        outRequest.write(inRequestBody);
        outRequest.end();

        outRequest.on('response', function(outResponse){
            inResponse.writeHead(outResponse.statusCode, outResponse.headers);
            outResponse.pipe(inResponse);

            var outResponseBody = '';

            outResponse.on('data', function(chunk) {
                outResponseBody += chunk;
            });

            outResponse.on('end', function() {
                console.log();
                console.log('=== Reponse ===');
                console.log(outResponse.statusCode);
                console.log(outResponse.headers);
                console.log(outResponseBody);
            });
        })
    });
};

http.createServer(requestListener).listen(8080);
