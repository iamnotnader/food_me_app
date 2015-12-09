/* jshint eqnull: true */

angular.module('foodMeApp.menuPageV2', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'ionic', 'foodmeApp.base64'])

.controller('MenuPageV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$ionicPopup", "base64",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $ionicPopup, base64) {
  var topViewObj = $('#top_view_container');
  var subviewObj = $('#home_page_v2__subview_container');

  $scope.allMenus = $scope.globals.allMenus;
  $scope.itemTapped = function(itemObj) {
    $scope.globals.itemToStartOn = itemObj;
    subviewObj.attr('class', 'slide-right');
    $scope.homeButtonPressed();
  };
}]);
