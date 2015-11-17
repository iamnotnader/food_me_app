/* jshint eqnull: true */

angular.module('foodMeApp.homePageV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodMeApp.stackHelper'])

.controller('HomePageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q", "fmaStackHelper", "$timeout", "$interval",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q, fmaStackHelper, $timeout, $interval) {
  var userCart = fmaLocalStorage.getObject('userCart');
  if (userCart == null) {
    userCart = [];
  }
  $scope.globals = {
    userAddress: fmaLocalStorage.getObject('userAddress'),
    userCart: userCart,
  };
  $scope.searchButtonPressed = function() {
    console.log('Search button pressed.');
    $('.swipe_page__bottom_bar').animate({left: '0%'});
    $location.path('/home_page_v2/search_page_v2');
  };
  $scope.homeButtonPressed = function() {
    console.log('Refresh button pressed.');
    $('.swipe_page__bottom_bar').animate({left: '33.33333%'});
    $location.path('/home_page_v2/swipe_page_v2');
  };
  $scope.cartButtonPressed = function() {
    console.log('Cart button pressed.');
    $('.swipe_page__bottom_bar').animate({left: '66.66666%'});
    $location.path('/home_page_v2/cart_page_v2');
  };
}]);
