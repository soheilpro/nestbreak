exports.settings = {
    // Go to https://dev.twitter.com/apps, create a new application and take your app tokens
    app: {
        consumer_key: '', 
        consumer_secret: '',
    },
    
    users: [
    // For each user that you want to enable access:
    {
        // Enter your twitter username
        username: '',
        
        // Choose a password (different from your real password)
        password: '',
        
        // Run accesstoken.js and follow the instructions to obtain your user tokens
        access_token: '',
        access_token_secret: '',
    }]
};