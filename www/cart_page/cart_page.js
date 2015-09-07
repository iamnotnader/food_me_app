/*jshint loopfunc: true, eqnull: true */

angular.module('foodMeApp.cartPage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/cart_page', {
    templateUrl: 'cart_page/cart_page.html',
    controller: 'CartPageCtrl'
  });
}])

.controller('CartPageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "fmaCartHelper", 
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, fmaCartHelper) {
  var mainViewObj = $('#main_view_container');

  // For the cart page, all we need is a token.
  console.log('In cart_page controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    console.log('Stored token being used.');
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    analytics.trackEvent('reroute', 'cart_page__intro_screen');

    alert('In order to swipe, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    $location.path('/intro_screen');
    return;
  }
  // At this point, we have a token.

  analytics.trackView('/cart_page');

  // Pull the cart items out of localStorage
  $scope.userCart = [];
  if (fmaLocalStorage.isSet('userCart')) {
    $scope.userCart = fmaLocalStorage.getObject('userCart');
  }

  $scope.removeFromCart = function(index) {
    analytics.trackEvent('cell', 'cart_page__remove_pressed');

    console.log("Removing item " + index);
    $scope.userCart.splice(index, 1);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);
  };

  var setCartTotal = function() {
    var total = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      total += parseFloat($scope.userCart[v1].price);
    }
    $scope.cartTotal = total.toFixed(2);
  };

  setCartTotal();
  $scope.$watch(
    function(scope) {
      // We only watch the cart length for efficiency reaasons.
      return scope.userCart.length;
    },
    function() {
      setCartTotal();
  });

  // Go through every cart item and make sure it's available. Warn the user if it
  // isn't.
  if ($scope.userCart.length > 0) {
    $scope.isLoading = true;
    var loadStartTime = (new Date()).getTime();
    $scope.cartItemsNotFound = [];
    $timeout(function() {
      // We need to upload all the cart items.
      fmaCartHelper.clearCartThenUpdateCartPromise($scope.userCart, $scope.rawAccessToken, null)
      .then(
        function(newCartItems) {
          // No need to update $scope.userCart items here because everything was added successfully.
          console.log('Cart updated successfully.');
          // In this case, we uploaded all the cart items to delivery.com successfully.
          var timePassedMs = (new Date()).getTime() - loadStartTime;
          analytics.trackTiming('loading', timePassedMs, 'cart_page_added_all_items');
          $timeout(function() {
            $scope.isLoading = false;
          }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
        },
        function(newCartItems) {
          console.log('Had to drop some cart items.');
          alert("Doh! One of the places you chose to order from just closed and we had to " +
                "remove their items from your cart :( " +
                "Just go back, hit refresh, and swipe some " +
                "more-- and be quicker this time!");
          // No need to update $scope.userCart because some items expired.
          $scope.userCart = newCartItems.added;
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'userCart', $scope.userCart,
              fmaSharedState.testing_invalidation_seconds);
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'foodData', null,
              fmaSharedState.testing_invalidation_seconds);


          // In this, someof the items in the cart didn't get uploaded. This is usually because
          // a store closed in the middle of the user's swiping.
          var timePassedMs = (new Date()).getTime() - loadStartTime;
          analytics.trackTiming('loading', timePassedMs, 'cart_page_missing_some_items');
          $timeout(function() {
            $scope.isLoading = false;
          }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
        }
      );
    }, 0);
  }

  var hasMoreThanOneMerchant = function(cartItems) {
    if (cartItems.length === 0) {
      return false;
    }
    var firstItem = cartItems[0];
    for (var v1 = 1; v1 < cartItems.length; v1++) {
      if (cartItems[v1].merchantId !== firstItem.merchantId) {
        return true;
      }
    }
    return false;
  };

  // If the user has items from more than one merchant, inform them that their
  // delivery times might be staggered.
  if (hasMoreThanOneMerchant($scope.userCart)) {
    console.log('More than one merchant detected.');
    alert("Looks like you're ordering from more than one merchant. This won't " +
          "affect the price at all, but keep in mind that you might receive " +
          "your items at slightly different times.");
  } else {
    console.log('Ordering from the same merchant.');
  }

  // A little more setup.
  $scope.cartBackButtonPressed = function() {
    analytics.trackEvent('nav', 'cart_page__back_pressed');

    console.log('Cart back button pressed.');
    // Clear the stack.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'foodData', null,
        fmaSharedState.testing_invalidation_seconds);
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/swipe_page');
  };

  $scope.cartFinishButtonPressed = function() {
    analytics.trackEvent('nav', 'cart_page__finish_pressed');

    if ($scope.userCart.length === 0) {
      alert('Bro, you need SOMETHING in your cart first. ' +
            'Go back and swipe-- the food loves you.');
      return;
    }
    console.log('Finish button pressed.');
    // First thing's first. Save the cart.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);

    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/choose_card');
  };

  $scope.cartPageClearCartPressed = function() {
    analytics.trackEvent('nav', 'cart_page__clear_pressed');

    console.log('Clear cart pressed.');
    $scope.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', [],
        fmaSharedState.testing_invalidation_seconds);
  };
  
}]);
