/* jshint eqnull: true */

angular.module('foodMeApp.cartPageV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('CartPageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q) {
  var setCartTotal = function() {
    var total = 0.0;
    for (var v1 = 0; v1 < $scope.globals.userCart.length; v1++) {
      total += parseFloat($scope.globals.userCart[v1].price);
    }
    $scope.cartTotal = total.toFixed(2);
  };

  setCartTotal();
  $scope.$watch(
    function(scope) {
      // We only watch the cart length for efficiency reaasons.
      return scope.globals.userCart.length;
    },
    function() {
      setCartTotal();
  });

  $scope.cartPageClearCartPressed = function() {
    console.log('Clear cart pressed.');
    $scope.globals.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', [],
        fmaSharedState.testing_invalidation_seconds);
  };

  $scope.removeFromCart = function(index) {
    console.log("Removing item " + index);
    $scope.globals.userCart.splice(index, 1);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.testing_invalidation_seconds);
  };
}]);
