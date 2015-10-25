angular.module('foodMeApp.recentOrdersPage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.controller('RecentOrdersPageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "$interval",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, $interval) {
  $scope.addRecentOrderToCart = function(index) {
    // Add the recent order to the cart.
    $scope.userCart.push($scope.recentOrders[index]);
    $scope.userCart = _.uniq($scope.userCart, function(item) {
      return item.unique_key;
    });
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', $scope.userCart,
        fmaSharedState.testing_invalidation_seconds);
  };
  
}]);
