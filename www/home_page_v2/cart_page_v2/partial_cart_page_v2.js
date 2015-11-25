/* jshint eqnull: true */

angular.module('foodMeApp.cartPageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'ionic'])

.controller('CartPageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$ionicPopup",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $ionicPopup) {
  var setCartTotal = function() {
    var total = 0.0;
    for (var v1 = 0; v1 < $scope.globals.userCart.length; v1++) {
      total += parseFloat($scope.globals.userCart[v1].price);
    }
    $scope.cartTotal = total.toFixed(2);
  };

  var setDedupedCart = function() {
    dedupedCart = [];
    for (var v1 = 0; v1 < $scope.globals.userCart.length; v1++) {
      dedupedCart.push({
        name: $scope.globals.userCart[v1].name,
        merchantName: $scope.globals.userCart[v1].merchantName,
        price: $scope.globals.userCart[v1].price,
        id: Math.random(),
      });
    }
    $scope.dedupedCart = dedupedCart;
  };

  setCartTotal();
  setDedupedCart();
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
    var confirmPopup = $ionicPopup.confirm({
      title: 'Burgie says...',
      template: 'You sure you want to clear your cart?',
      cancelText: 'Nah',
      okText: 'Yeah',
    });
    confirmPopup.then(function(res) {
      if(res) {
        console.log('Clearing cart.');
        $scope.globals.userCart = [];
        fmaLocalStorage.setObjectWithExpirationSeconds(
            'userCart', [],
            fmaSharedState.testing_invalidation_seconds);
      } else {
        console.log('Not clearing cart.');
      }
    });
  };

  $scope.removeFromCart = function(index) {
    console.log("Removing item " + index);
    $scope.globals.userCart.splice(index, 1);
    $scope.dedupedCart.splice(index, 1);
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.globals.userCart,
        fmaSharedState.testing_invalidation_seconds);
  };
}]);
