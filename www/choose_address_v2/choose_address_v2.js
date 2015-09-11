angular.module('foodMeApp.chooseAddressV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address_v2', {
    templateUrl: 'choose_address_v2/choose_address_v2.html',
    controller: 'ChooseAddressV2Ctrl'
  });
}])

.controller('ChooseAddressV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {
  var mainViewObj = $('#main_view_container');

  analytics.trackView('/choose_address_v2');
  $scope.locationList = fmaLocalStorage.getObject('recentAddresses');
  if ($scope.locationList == null) {
    $scope.locationList = [];
  }

  $scope.getAutocomplete = function(query) {
    debugger;
  }

  $scope.doneButtonPressed = function() {
    analytics.trackEvent('nav', 'choose_address_v2__done_pressed');
    console.log('Done button pressed.');
  };
}]);
