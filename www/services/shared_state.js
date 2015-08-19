angular.module('foodmeApp.sharedState', [])

// Just holds some global configuration variables that we can set to whatever
// we need.
.factory('fmaSharedState', [function() {
  return {
    // These are the credentials we need to interact with delivery.com's API
    client_id: 'NDIyZDg1MjA0M2M4Y2NhYzgxOGY1NDhjMmE0YTIwMTJh',
    client_secret: 'YEQZ54Wvth4TDtpNclTxOolRVgX6UK79pNw82O1s',
    redirect_uri: 'http://localhost:3000',
    // This determines whether or not we redirect the user to different screens.
    // For example, we might redirect the user to the intro_screen if their
    // token isn't set. Setting this to false would disable this behavior for
    // testing purposes.
    possibleStates: [
      'NY', 'VA',
    ],

    // Variables that are strictly for testing purposes.

    // Testing
    //testing_invalidation_seconds: 60 * 60,
    //fake_token: 'Q9rcncn0daWlTrAqa67soecPjFURIsy43p21Cj1s',

    // Prod
    // Invalidate everything in localStorage after this amount of time for now.
    testing_invalidation_seconds: 60,
    fake_token: null,

  };
}]);
