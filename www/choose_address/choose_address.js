angular.module('foodMeApp.chooseAddress', ['ngRoute', 'ngTouch'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address', {
    templateUrl: 'choose_address/choose_address.html',
    controller: 'ChooseAddressCtrl'
  });
}])

.controller('ChooseAddressCtrl', ["$scope", "$location", function($scope, $location) {
  $scope.testString = "testing choose_address";
}]);
