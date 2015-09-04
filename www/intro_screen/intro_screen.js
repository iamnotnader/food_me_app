angular.module('foodMeApp.introScreen', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/intro_screen', {
    templateUrl: 'intro_screen/intro_screen.html',
    controller: 'IntroScreenCtrl'
  });
}])

.controller('IntroScreenCtrl', ["$scope", "$location", "$http", "fmaLocalStorage", 'fmaSharedState', '$rootScope', '$timeout',
function($scope, $location, $http, fmaLocalStorage, fmaSharedState, $rootScope, $timeout) {
  if (fmaSharedState.testModeEnabled) {
    // Skip the login in test mode.
    $location.path('/choose_address');
  }

  if (window.analytics != null) {
    // For some reason deviceready doesn't execute fast enough sometimes.
    analytics.trackView('/intro_screen');
  }

  // Clear all the user data and start fresh.
  fmaLocalStorage.clear();

  // Capture the main view container so we can add/remove animations.
  var mainViewObj = $('#main_view_container');
  mainViewObj.removeClass();

  // Default to sliding left.
  mainViewObj.addClass('slide-left-in slide-left-out');

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
  // We have a single giant png that contains all of the app intro screens. Its
  // width should be screenshotWidth * numPhotos so we can slide through it
  // properly.
  $scope.numPhotos = 5;
  // The list of background colors for our intro screen. You should be able to
  // add more without anything breaking, but you won't see them unless you make
  // numPhotos bigger above to correspond. Note that you can have fewer colors
  // than photos and the colors will just repeat.
  $scope.colorList = ["rgb(154, 97, 56)", "rgb(154, 56, 84)", "rgb(62, 145, 146);"];
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
  $scope.oauthUrl = fmaSharedState.endpoint+'/third_party/account/create?' +
                    'client_id=' + fmaSharedState.client_id + '&' +
                    'redirect_uri=' + fmaSharedState.redirect_uri + '&' +
                    'response_type=code&' +
                    'scope=global&' +
                    'state=';
  $scope.token_data = null;
  $scope.signInButtonClicked = function() {
    analytics.trackEvent('button', 'intro_screen__signin_pressed');

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
        'location=yes,transitionstyle=crossdissolve,clearcache=yes');
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
          url: fmaSharedState.endpoint+'/third_party/access_token',
          data: 'client_id='+fmaSharedState.client_id+'&' +
                'redirect_uri=http://localhost:3000&' +
                'grant_type=authorization_code&' +
                'client_secret=' + fmaSharedState.client_secret + '&' +
                'code=' + code[1]
        }).then(function(response) {
          $scope.token_data = response.data;
          fmaLocalStorage.setObjectWithExpirationSeconds('userToken', $scope.token_data,
              fmaSharedState.testing_invalidation_seconds);
          $location.path('/choose_address');
          return;
        }, function(error) {
          alert('Whoops! Something went wrong when logging in. ' +
                'Just restart the app and login again and it should ' +
                'work-- promise.');
        });
        ref.close();
      }
    });
    ref.addEventListener('loadstop', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) > 0) {
        // We only execute this block if the redirect_uri appears as a
        // parameter in the URL.
        var codeToAddFoodMePrivacyPolicy = (
          "var footer = document.querySelector('footer');" +
          "var header=document.querySelector('header > h1'); " +
          "header.innerHTML = header.innerHTML + '<br>By logging in " +
              "you agree to the FoodMe " +
              "<a href=\"http://www.foodme.io/#/privacy_page#topOfPage\">Privacy Policy</a>.<br><br>' + " +
              "footer.innerHTML; " +
          "footer.style.visibility = 'hidden';" +
          "header.style.lineHeight = '20px'; " +
          "header.style.margin = '15px 10px';" +
          "var disclaimer = document.querySelector('.disclaimer');" +
          "if (disclaimer != null) {" +
            "disclaimer.style.display = 'none';" +
          "}"
        );
        ref.executeScript({
            code: codeToAddFoodMePrivacyPolicy,
        }, function() {
        });
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
              $('.intro_screen__outer_screenshot_container').width(scope.screenshotWidth);
  
              scope.textWidth =  $('.intro_screen__overall_text_container').width();
              $('.intro_screen__outer_screenshot_container').show();
              scope.innerScreenshotContainer = $('.intro_screen__inner_screenshot_container');

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
      var startX = 0, startingTextOffset, amountMoved;
      var textObject = $('.intro_screen__overall_text_container');
      var backgroundObject = $('.intro_screen__upper_container');

      element.on('touchstart', function(event) {
        analytics.trackEvent('slide', 'intro_screen_slide_start');

        // Prevent default dragging of selected content
        event.preventDefault();
        startX = event.originalEvent.touches[0].pageX;
        startingTextOffset = scope.textOffset;
        amountMoved = 0;
        $document.on('touchmove', touchmove);
        $document.on('touchend', touchend);
      });

      function touchmove(event) {
        amountMoved = (event.originalEvent.touches[0].pageX - startX) / 2.0;
        scope.textOffset = (startingTextOffset + amountMoved);
        scope.textOffset =
            Math.max(scope.textOffset,
            -1 * (scope.numPhotos-1) * scope.textWidth);
        scope.textOffset =
            Math.min(scope.textOffset, 0);
        textObject.css({left: scope.textOffset});
        var leftPercent = Math.floor(scope.textOffset * 100.0 / scope.textWidth) + '%';
        scope.innerScreenshotContainer.css({left: leftPercent});
      }

      function touchend() {
        $document.off('touchmove', touchmove);
        $document.off('touchend', touchend);
        // Compute the index of the screen we're going to snap to.
        var screenIndex = Math.floor(Math.abs(scope.textOffset) / scope.textWidth);

        // We have to add 1 in the equation below because of floating point precision issues.
        var remainder = (Math.abs(scope.textOffset) + 1) % scope.textWidth;
        if (remainder > 0 && amountMoved < 0) {
          screenIndex += 1;
        }
        screenIndex = Math.min(screenIndex, scope.numPhotos - 1);
        // Compute the final position we want the text to snap to.
        var finalTextOffset = -1 * screenIndex * scope.textWidth;
        scope.textOffset = finalTextOffset;
        textObject.animate(
            {left: finalTextOffset}, 200);
        var leftPercent = Math.floor(scope.textOffset * 100.0 / scope.textWidth) + '%';
        scope.innerScreenshotContainer.animate({left: leftPercent}, 200);

        // Compute the color we want the background to end up at.
        scope.colorIndex = screenIndex % scope.colorList.length;
        backgroundObject.animate(
            {backgroundColor: scope.colorList[scope.colorIndex]}, 200);

        scope.setActiveDot(screenIndex);
      }
    }
  };
}]);
