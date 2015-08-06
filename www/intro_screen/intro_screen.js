angular.module('foodMeApp.introScreen', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/intro_screen', {
    templateUrl: 'intro_screen/intro_screen.html',
    controller: 'IntroScreenCtrl'
  });
}])

.controller('IntroScreenCtrl', ["$scope", function($scope) {
  $scope.testString = "test";
  // The width of the phone png. Gets set in introScreenImageOnload
  $scope.phoneWidth = 0;
  // The width of the screenshot embedded within the phone. Computed from the
  // phone's width.
  $scope.screenshotWidth = 0;
  // The amount we shift the screenshot. The screenshot is actually three
  // images next to each other. When we slide our finger across the screen, the
  // screenshots all slide by adjusting this variable.
  $scope.screenshotOffset = 0;
}])

//We set the phoneWidth on the scope so we can use it to set the width of the
//screenshot within the phone.
.directive('introScreenImageOnload', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind('load', function() {
              scope.phoneWidth = element.width();
              //This is based on the relative width of the phone and the
              //screenshot. This is shitty and I wanted to bind the actual
              //screenshot element with the width variable but it didn't work.
              scope.screenshotWidth = scope.phoneWidth * (150.0/175);
              $('.intro_screen__screenshot_container').width(scope.screenshotWidth);
            });
        }
    };
})

.directive('introScreenSwipeThrough', ['$document', function($document) {
  return {
    link: function(scope, element, attr) {
      var startX = 0, numPhotos = 3;

      element.on('touchstart', function(event) {
        // Prevent default dragging of selected content
        event.preventDefault();
        startX = event.originalEvent.touches[0].pageX - scope.screenshotOffset;
        $document.on('touchmove', touchmove);
        $document.on('touchend', touchend);
      });

      function touchmove(event) {
        scope.screenshotOffset = event.originalEvent.touches[0].pageX - startX;
        scope.screenshotOffset = Math.min(scope.screenshotOffset, 0);
        scope.screenshotOffset =
            Math.max(scope.screenshotOffset,
            -1 * (numPhotos-1) * scope.screenshotWidth);
        // Move the screenshot over.
        $('.intro_screen__all_intro_screenshots').css({left: scope.screenshotOffset});
      }

      function touchend() {
        $document.off('touchmove', touchmove);
        $document.off('touchend', touchend);
        // The +/- signs are annoying here. Sorry.
        var finalOffset = scope.screenshotOffset;
        var modded = ((-1*scope.screenshotOffset) % scope.screenshotWidth);
        if (modded > (scope.screenshotWidth / 2)) {
          finalOffset = finalOffset - (scope.screenshotWidth - modded);
        } else {
          finalOffset = finalOffset + modded;
        }
        scope.screenshotOffset = finalOffset;
        $('.intro_screen__all_intro_screenshots').animate({left: finalOffset}, 200);
      }
    }
  };
}]);
