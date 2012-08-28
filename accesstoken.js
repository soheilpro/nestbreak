var util = require('util');
var oauth = require('oauth').OAuth;
var settings = require('./settings').settings;

var oa = new oauth("https://api.twitter.com/oauth/request_token",
                   "https://api.twitter.com/oauth/access_token",
                   settings.app.consumer_key,
                   settings.app.consumer_secret,
                   "1.0",
                   "oob",
                   "HMAC-SHA1");

oa.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
    if (error) {
        console.log('Error: Cannot access twitter.com.');
        return;
    }

    console.log('Open this address, authorize, and then copy the PIN code:');
    console.log('https://api.twitter.com/oauth/authorize?oauth_token=' + oauth_token);
    console.log();
    console.log('PIN code?');

    process.stdin.resume();

    process.stdin.once("data", function(data) {
        process.stdin.pause();

        var pin = data.toString().replace(/(\r|\n)/g, '');

        console.log();

        oa.getOAuthAccessToken(oauth_token, oauth_token_secret, pin, function(error, oauth_access_token, oauth_access_token_secret) {
            if (error) {
                console.log('Error: Invalid PIN code.');
                return;
            }

            console.log('access_token: ' + oauth_access_token);
            console.log('access_token_secret: ' + oauth_access_token_secret);
        });
    });
});