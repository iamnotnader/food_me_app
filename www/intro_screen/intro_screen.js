angular.module('foodMeApp.introScreen', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/intro_screen', {
    templateUrl: 'intro_screen/intro_screen.html',
    controller: 'IntroScreenCtrl'
  });
}])

.controller('IntroScreenCtrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState) {
  // This is the first screen our app hits when it restarts, so we put some custom
  // logic in to redirect if the user is already signed in, has already entered
  // an address, etc...
  console.log('In intro controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake access token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    console.log('Stored access token being used.');
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken !== null) {
    // Getting here implies user has logged in already.
    if (fmaLocalStorage.isSet('userAddress')) {
      if (fmaLocalStorage.isSet('userCuisines')) {
        // Logged in with a chosen address and cuisines implies we go to the swipe page.
        console.log('We have token, address, and cuisines so go to the swipe page.');
        $location.path('/swipe_page');
        return;
      }
      // If we have a token and an address but no cuisines, we have to choose some.
      console.log('We have token, address but missing cuisines.');
      $location.path('/choose_cuisine');
      return;
    } else {
      // Logged in without an address implies we need to choose one.
      console.log('We have token but no address.');
      $location.path('/choose_address');
      return;
    }
  }
  // We get here only if the user doesn't have an access token.

  // This line is necessary in order to make Angular $http post requests behave
  // like jQuery $.post requests. Namely, it makes it so the params are added
  // to the URL like ?a=whatever&b=whatever instead of sent as JSON. This is
  // necessary because the delivery.com API is php and doesn't like JSON.
  $http.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

  // The width of the phone png. Gets set in introScreenImageOnload
  $scope.phoneWidth = 0;
  // The width of the screenshot embedded within the phone. Computed from the
  // phone's width in the introScreenImageOnload directive.
  $scope.screenshotWidth = 0;
  // The amount we shift the screenshot. The screenshot is actually three
  // images next to each other. When we slide our finger across the screen, the
  // screenshots all slide by adjusting this variable.
  $scope.screenshotOffset = 0;
  // We have a single giant png that contains all of the app intro screens. Its
  // width should be screenshotWidth * numPhotos so we can slide through it
  // properly.
  $scope.numPhotos = 4;
  // The list of background colors for our intro screen. You should be able to
  // add more without anything breaking, but you won't see them unless you make
  // numPhotos bigger above to correspond. Note that you can have fewer colors
  // than photos and the colors will just repeat.
  $scope.colorList = ["#8C6954", "#BFAF80", "#260126"];
  // The index into colorList that determines which background color we're on
  // currently.
  $scope.colorIndex = 0;
  // The width of the box containing text. Set in the introScreenImageOnload
  // directive so we can avoid computing it with jQuery.
  $scope.textWidth = 0;
  // The amount we shift the intro text. The intro text is actually three divs
  // next to each other all side by side. When we slide our finger across the
  // screen, the divs all slide by adjusting this variable.
  $scope.textOffset = 0;
  // For every pixel we move the screenshot, we have to move the text over by
  // this ratio. This is set in the introScreenImageOnload directive.
  $scope.textToScreenshotRatio = 0;

  // When we're on the Nth screen, we want to set the Nth dot as "active." That
  // basically means make it a little bigger and make its color equal to the
  // background.
  $scope.setActiveDot = function(dotIndex) {
    // Kinda gross. We have to reset the background color manually on all the
    // other dots.
    for (var i = 0; i < $scope.numPhotos; i++) {
      var grey_1 = "#707070";
      $('.intro_screen__dot-'+i).css('background-color', grey_1);
    }    
    // unset the last active dot.
    $('.intro_screen__active_dot').removeClass('intro_screen__active_dot');
    // Set the active dot.
    $('.intro_screen__dot-'+dotIndex).css('background-color',
        $scope.colorList[dotIndex % $scope.colorList.length])
        .addClass('intro_screen__active_dot'); 
  };

  // This URL gives us back an access code, which we can then exchange for an
  // access token. What follows is a dance between us and delivery.com to get
  // the sweet, sweet access token that we need to do everything.
  $scope.oauthUrl = 'https://api.delivery.com/third_party/authorize?' +
                    'client_id=' + fmaSharedState.client_id + '&' +
                    'redirect_uri=' + fmaSharedState.redirect_uri + '&' +
                    'response_type=code&' +
                    'scope=global&' +
                    'state=';
  $scope.token_data = null;
  $scope.signInButtonClicked = function() {
    console.log("Delivery button clicked!");

    // Do a dance to get a token for the used.
    // This is a hack but it looks like it's supported by Google...
    // Basically the flow is this:
    //   1) Open the delivery.com oauth page in a new webview.
    //   2) User types credentials
    //   3) delivery.com redirects to localhost:3000?code=blah
    //   4) We grab the value of code in the start listener then kill the
    //      webview.
    var ref = window.open($scope.oauthUrl, '_blank',
        'location=yes,toolbar=no,clearcache=yes,clearsessioncache=yes');
    ref.addEventListener('loadstart', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) === 0) {
        var code = /\?code=(.+)[&|$]/.exec(url);
        var error = /\?error=(.+)[&|$]/.exec(url);
        // We have to send like this instead of just doing $http.post because
        // the delivery.com API doesn't like JSON. See the comment at the top
        // of the controller. Note that this is obviously super insecure.
        $http({
          method: "post",
          url: "https://api.delivery.com/third_party/access_token",
          data: 'client_id=NDIyZDg1MjA0M2M4Y2NhYzgxOGY1NDhjMmE0YTIwMTJh&' +
                'redirect_uri=http://localhost:3000&' +
                'grant_type=authorization_code&' +
                'client_secret=' + fmaSharedState.client_secret + '&' +
                'code=' + code[1]
        }).then(function(response) {
          $scope.token_data = response.data;
          fmaLocalStorage.setObjectWithExpirationSeconds('userToken', $scope.token_data,
              fmaSharedState.testing_invalidation_seconds);
          alert('Got token: ' + JSON.stringify($scope.token_data));
          // TODO(daddy): Add the token to some global state before transitioning.
          $location.path('/choose_address');
          return;
        }, function(error) {
          // TODO(daddy): Change this to something more user-friendly.
          alert('Post to get token failed with response: ' + error.statusText);
        });
        ref.close();
        // TODO(daddy): Initiate some loading animation maybe.
      }
    });
  };
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
  
              scope.textWidth =  $('.intro_screen__overall_text_container').width();
              scope.textToScreenshotRatio = scope.textWidth / scope.screenshotWidth;

              scope.setActiveDot(0);
              
              $('.intro_screen__upper_container').css('background-color',
                  scope.colorList[0]);
            });
        }
    };
})

.directive('introScreenSwipeThrough', ['$document', function($document) {
  return {
    link: function(scope, element, attr) {
      var startX = 0;

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
            -1 * (scope.numPhotos-1) * scope.screenshotWidth);
        scope.textOffset = Math.min(scope.screenshotOffset * scope.textToScreenshotRatio, 0);
        scope.textOffset =
            Math.max(scope.textOffset,
            -1 * (scope.numPhotos-1) * scope.textWidth);
        // Move the screenshot over.
        $('.intro_screen__all_intro_screenshots').css({left: scope.screenshotOffset});
        $('.intro_screen__overall_text_container').css({left: scope.textOffset});
      }

      function touchend() {
        $document.off('touchmove', touchmove);
        $document.off('touchend', touchend);
        // Compute the index of the screen we're going to snap to.
        var screenIndex = Math.floor(Math.abs(scope.screenshotOffset) / scope.screenshotWidth);
        if (Math.abs(scope.screenshotOffset) % scope.screenshotWidth >
            scope.screenshotWidth / 2) {
          screenIndex += 1;
        }
        // Compute the final position we want the screenshot to snap to.
        var finalScreenshotOffset = -1 * screenIndex * scope.screenshotWidth;
        scope.screenshotOffset = finalScreenshotOffset;
        $('.intro_screen__all_intro_screenshots').animate(
            {left: finalScreenshotOffset}, 200);

        // Compute the final position we want the text to snap to.
        var finalTextOffset = -1 * screenIndex * scope.textWidth;
        scope.textOffset = finalTextOffset;
        $('.intro_screen__overall_text_container').animate(
            {left: finalTextOffset}, 200);

        // Compute the color we want the background to end up at.
        scope.colorIndex = screenIndex % scope.colorList.length;
        $('.intro_screen__upper_container').animate(
            {backgroundColor: scope.colorList[scope.colorIndex]}, 200);

        scope.setActiveDot(screenIndex);
      }
    }
  };
}]);
