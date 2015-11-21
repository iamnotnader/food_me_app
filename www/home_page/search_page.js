angular.module('foodMeApp.searchPage', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.controller('SearchPageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "$interval",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, $interval) {
  // Note that the parent controller is HomePageCtrl.
  $scope.keywordDidChange = function() {
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'searchQuery', $scope.searchQuery,
        fmaSharedState.testing_invalidation_seconds);
  };
  $scope.clearTextPressed = function() {
    $('.choose_address_v2__inner_input').val('');
    $scope.searchQuery.query = '';
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'searchQuery', $scope.searchQuery,
        fmaSharedState.testing_invalidation_seconds);
  };
  $scope.executeSearchPressed = function() {
    $scope.refreshButtonPressed();
  };
}]);
