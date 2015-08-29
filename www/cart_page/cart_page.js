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
    alert('In order to swipe, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    $location.path('/intro_screen');
    return;
  }
  // At this point, we have a token.

  // Pull the cart items out of localStorage
  $scope.userCart = [];
  if (fmaLocalStorage.isSet('userCart')) {
    $scope.userCart = fmaLocalStorage.getObject('userCart');
  }

  $scope.removeFromCart = function(index) {
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
      fmaCartHelper.clearCartThenUpdateCartPromise($scope.userCart, $scope.rawAccessToken)
      .then(
        function(newCartItems) {
          // No need to update $scope.userCart items here because everything was added successfully.
          console.log('Cart updated successfully.');
          // In this case, we uploaded all the cart items to delivery.com successfully.
          var timePassedMs = (new Date()).getTime() - loadStartTime;
          $timeout(function() {
            $scope.isLoading = false;
          }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
        },
        function(newCartItems) {
          console.log('Had to drop some cart items.');
          alert("Doh! Some of the items in your cart expired. This usually " +
                "happens when a store closes before you can check out. Just go swipe some " +
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
          $timeout(function() {
            $scope.isLoading = false;
          }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
        }
      );
    }, 0);
  }

  // A little more setup.
  $scope.cartBackButtonPressed = function() {
    console.log('Cart back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/swipe_page');
  };

  $scope.cartFinishButtonPressed = function() {
    if ($scope.userCart.length === 0) {
      alert('Bro, you need SOMETHING in your cart first. ' +
            'Go back and swipe-- the food loves you.');
      return;
    }
    // Cull down $scope.itemRequestObjects to get it in line with cartItems.
    // Save cartItems
    // Save itemRequestObjects
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
    console.log('Clear cart pressed.');
    $scope.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', [],
        fmaSharedState.testing_invalidation_seconds);
  };
  
}]);
