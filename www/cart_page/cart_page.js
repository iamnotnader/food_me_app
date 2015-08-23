/*jshint loopfunc: true */

angular.module('foodMeApp.cartPage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/cart_page', {
    templateUrl: 'cart_page/cart_page.html',
    controller: 'CartPageCtrl'
  });
}])

.controller('CartPageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout) {
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

  // Finds the desiredItem inside menuResponse and returns the menuResponse version.
  // The menuResponse version of the item will be more complete. Returns null if it
  // can't find it.
  var findMatchingMenuItem = function(menuResponse, desiredItem) {
    // TODO(daddy): Fill this in.
    //var matchingMenuObj = null;
    //for (var menuItemIndex = 0; menuItemIndex < menuArr.length; menuItemIndex++) {
      //debugger;
      //console.log(menuArr[menuItemIndex].id + " -- " + cartItem.navigation_id);
      //if(menuArr[menuItemIndex].id === cartItem.navigation_id) {
        //matchingMenuObj = menuArr[menuItemIndex];
        //break;
      //}
    //}
  };

  $scope.userCartItemDetails = [];
  $scope.isLoading = true;
  for (var x = 0; x < $scope.userCart.length; x++) {
    (function(cartIndex) {
      var cartItem = $scope.userCart[cartIndex];
      $http.get('https://api.delivery.com/merchant/'+cartItem.merchantId+'/menu?client_id=' + fmaSharedState.client_id)
      .then(
        function(res) {
          var menuArr = res.data.menu;
          var matchingMenuObj = findMatchingMenuItem(res, cartItem);
        },
        function(err) {
        });
    })(x);
  }
}]);
