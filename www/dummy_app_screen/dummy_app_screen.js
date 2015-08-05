angular.module('foodMeApp.dummyAppScreen', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/dummy_app_screen', {
    templateUrl: 'dummy_app_screen/dummy_app_screen.html',
    controller: 'DummyAppScreenCtrl'
  });
}])

.controller('DummyAppScreenCtrl', ["$scope", "$interval", function($scope, $interval) {
  var naderIsKingText = "Nader is KING.";
  var naderIsAllText = "Nader is ALL.";
  var isKing = true;
  $scope.naderText = naderIsKingText;
  stop = $interval(
    function() {
      isKing = !isKing;
      if (isKing) {
        $scope.naderText = naderIsKingText;
      } else {
        $scope.naderText = naderIsAllText;
      }
    }, 1000);

    $scope.$on('$destroy', function() {
      // Make sure that the interval is destroyed too
      if (angular.isDefined(stop)) {
        $interval.cancel(stop);
        stop = undefined;
      }
    });
}]);
