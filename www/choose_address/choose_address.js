angular.module('foodMeApp.chooseAddress', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address', {
    templateUrl: 'choose_address/choose_address.html',
    controller: 'ChooseAddressCtrl'
  });
}])

.controller('ChooseAddressCtrl', ["$scope", "$location", "$localStorage", "$http", "$sharedState",
function($scope, $location, $localStorage, $http, $sharedState) {
  $scope.userToken = $localStorage.getObject('userToken');
  alert(!_.has($scope.userToken, 'access_token'));
  if (!_.has($scope.userToken, 'access_token')) {
    $location.path('/intro_screen');
    return;
  }
  $scope.locationList = {};
  $http.defaults.headers.common.Authorization = $scope.userToken.access_token;
  $http.get('https://api.delivery.com/customer/location?client_id=' + $sharedState.client_id).then(
  function(res) {
    $scope.locationList = res.data.locations;
    alert(JSON.stringify($scope.locationList));
  },
  function(err) {
    alert('Error fetching addresses: ' + err.statusText);
  });
  
}]);
