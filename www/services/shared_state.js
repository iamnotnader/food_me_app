// This is the most important variable in the whole codebase. If it's set
// to true, we're in testing mode, which means we hit sandbox.delivery.com.
// Otherwise, we're in prod mode, which means we hit api.delivery.com.
var testModeEnabled = true;

// Even if testModeEnabled = false, it's nice to have a flag we can use to
// turn payment on/off.
var takePayment = true;

angular.module('foodmeApp.sharedState', [])

// Just holds some global configuration variables that we can set to whatever
// we need.
.factory('fmaSharedState', [function() {
  var stateObj = {
    testModeEnabled: testModeEnabled,
    takePayment: takePayment,

    // These are the credentials we need to interact with delivery.com's API
    client_id: 'NDIyZDg1MjA0M2M4Y2NhYzgxOGY1NDhjMmE0YTIwMTJh',
    client_secret: 'YEQZ54Wvth4TDtpNclTxOolRVgX6UK79pNw82O1s',
    endpoint: 'https://api.delivery.com',
    redirect_uri: 'http://localhost:3000',


    // This determines whether or not we redirect the user to different screens.
    // For example, we might redirect the user to the intro_screen if their
    // token isn't set. Setting this to false would disable this behavior for
    // testing purposes.
    possibleStates: [
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
      'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
      'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    ],

    getDayAsString: function() {
      var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      return days[new Date().getDay()];
    },

    instructions: 'Tell people to download the FoodMe app and get more orders!',

    taxRate: 0.09,

    tipAmount: 1.0,

    maxDishesToReturn: 400,

    numMerchantsToFetch: 10,

    promiseTimeoutMs: 15000,

    numCuisinesToShow: 30,

    // This is how we get commissions. It is the "You hear about us" ID from delivery.com.
    // Contact baltomare@delivery.com for questions.
    uhau_id: 50702,

    // This is our Google Analytics id that we use to track events.
    ga_id: 'UA-58354537-3',

    // Controls how long the loading screen shows for. If you make this too small,
    // the app looks buggy because the loading screen snaps away in the middle of
    // screen transitions.
    minLoadingMs: 1500,

    // Controls how long the loading screen shows for. If you make this too small,
    // the app looks buggy because the loading screen snaps away in the middle of
    // loading the swipe cards.
    minSwipeLoadingMs: 1000,

    // Prod
    // Basically never invalidate the cache.
    testing_invalidation_seconds: 60 * 60 * 24 * 365 * 10,
    fake_token: null,

  };

  // The variables below are set strictly for testing purposes.
  if (testModeEnabled) {
    alert('Warning! Using test account!');

    // These are the credentials we need to interact with delivery.com's API
    stateObj.client_id = 'MDU1YmQ3MzM1M2I3MmU0ZTk4NDUwZTVmZDBiZGY4MDFk';
    stateObj.client_secret = 'azC3JXeAX9U57qDNUo1st2YhKm59lMZ2YC83Ck6P';
    stateObj.endpoint = 'https://sandbox.delivery.com';

    // Testing
    stateObj.testing_invalidation_seconds = 60 * 60;
    stateObj.fake_token = 's5XfkXRCxWtTZ3KrmX4KxCHafEnrM6fnicaSQKlZ';
    stateObj.uhau_id = null;
  }

  return stateObj;
}]);
