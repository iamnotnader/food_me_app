angular.module('foodMeApp.stackV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('StackV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {
  $scope.infoPressed = function() {
    console.log('info');
  };
  $scope.likePressed = function() {
    console.log('like');
  };
  $scope.dislikePressed = function() {
    console.log('dislike');
  };
  $scope.shuffleDishesPressed = function() {
    console.log('shuffleDishes');
  };
  $scope.shuffleMerchantsPressed = function() {
    console.log('shuffleMerchants');
  };
  $scope.$watch('globals.userAddress', function() {
    var userAddress = $scope.globals.userAddress;
    if (userAddress == null || userAddress == '') {
      console.log('No address-- not doing anything.');
      return;
    }
    console.log('hey, myVar has changed!');
  });
}]);
