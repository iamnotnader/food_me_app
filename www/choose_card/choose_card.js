//----------------------------------------------------------------------------------
// The following is the list of steps we take in this controller.
//
// Asynchronously:
//   Get the itemDetailsFound
//   Make sure it matches up exactly with the userCart (if they don't, reset both
//   and return to the cart page or something.)
//   If they match, construct a request object for each item consisting of a link and an object
//   Clear the old cart
//   Send all the request objects
//
// What the user sees:
//   Get the credit cards
//   Make them pick one
//   Potentially add one
//   Send the transaction through when they hit finish.
//
//----------------------------------------------------------------------------------


angular.module('foodMeApp.chooseCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodmeApp.cartHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_card', {
    templateUrl: 'choose_card/choose_card.html',
    controller: 'ChooseCardCtrl'
  });
}])

.controller('ChooseCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "fmaCartHelper", "$route",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, fmaCartHelper, $route) {
  var mainViewObj = $('#main_view_container');

  // On this screen, we need a valid user token. If we are missing one, we need
  // to go back to the intro_screen to get it.
  //
  // We also need a nonempty cart, but that should be naturally enforced by the
  // last page. Just in case, though...
  console.log('In choose_card controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake access token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if ($scope.userToken != null && _.has($scope.userToken, 'access_token')) {
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    alert('In order to choose an address, we need you to log in first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/intro_screen');
    return;
  }
  $scope.userCart = fmaLocalStorage.getObject('userCart');
  $scope.itemDetailsFound = fmaLocalStorage.getObject('itemDetailsFound');
  if ($scope.userCart == null || $scope.userCart.length === 0) {
    // We redirect to the cart page if the cart is empty.
    alert('We need something in your cart first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  if ($scope.itemDetailsFound == null ||
      $scope.userCart.length !== $scope.itemDetailsFound.length) {
    alert('Something really weird happened-- tell me: 212-729-6389. ' +
          'Also give me this code: fucked_up_item_details');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  // If we get here, we have a valid user token AND userCart is nonempty AND
  // itemDetailsFound matches up with userCart. Woohoo!

  $scope.isLoading = true;
  var loadStartTime = (new Date()).getTime();
  $scope.cardList = [];
  $scope.selectedCardIndex = { value: null };
  $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
  $http.get(fmaSharedState.endpoint+'/customer/cc?client_id=' + fmaSharedState.client_id)
  .then(
    function(res) {
      $scope.cardList = res.data.cards;
      var currentCard = fmaLocalStorage.getObject('userCreditCard');
      if (currentCard != null) {
        for (var i = 0; i < $scope.cardList.length; i++) {
          if ($scope.cardList[i].cc_id === currentAddress.cc_id) {
            $scope.selectedCardIndex.value = i;
            break;
          }
        }
      }
      // Make the loading last at least a second.
      var timePassedMs = (new Date()).getTime() - loadStartTime;
      $timeout(function() {
        $scope.isLoading = false;
      }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
    },
    function(err) {
      alert('Error fetching cards: ' + err.statusText);
      console.log(err);
      return;
  });


  $scope.chooseCardBackPressed = function() {
    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('cart_page');
    return;
  };

  $scope.chooseCardFinishPressed = function() {
    console.log('Finish button pressed.');

    // WE NEED TO CHECKK finishedUploadingCartItems here!!!
    if (!$scope.finishedUploadingCartItems) {
      alert("Wait! I'm still uploading some of your information " +
            "in the background. Give me like ten seconds tops.");
      return;
    }

    if ($scope.selectedCardIndex.value == null) {
      alert("SELECT A CARD. DO AS I SAY. I AM GOD.");
      return;
    }

    var foodNames = [];
    var sum = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      foodNames.push($scope.userCart[v1].name + ': $' + $scope.userCart[v1].price);
      sum += parseFloat($scope.userCart[v1].price);
    }
    confirm("Ready to order the following?\n\n" + foodNames.join('\n') +
            '\n\nFor a total of: $' + sum.toFixed(2) + '?',
      function(index) {
        if (index === 1) {
          // Dude.. this is the money.
          alert("Thanks! I just took your money and your order will arrive in less " +
                "than half an hour. Unless it doesn't. It probably will, though, " +
                "maybe.");
        }
      }
    )
    return;
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    console.log('Cell selected: ' + indexSelected);
    $scope.selectedCardIndex.value = indexSelected;
  };

  $scope.addCardButtonPressed = function() {
    console.log('Add card pressed!');
    var addCardUrl = fmaSharedState.endpoint+'/third_party/credit_card/add?' +
                    'client_id=' + fmaSharedState.client_id + '&' +
                    'redirect_uri=' + fmaSharedState.redirect_uri + '&' +
                    'response_type=code&' +
                    'scope=global&';

    var ref = window.open(addCardUrl, '_blank',
        'location=yes,transitionstyle=crossdissolve');
    ref.addEventListener('loadstart', function(event) {
      var url = event.url;
      if (url.indexOf(fmaSharedState.redirect_uri) === 0) {
        // We use $route.reload to force a reload of the card list.
        mainViewObj.removeClass();
        $route.reload();

        ref.close();
        return;
      }
    });
  };

  // We need to upload all the cart items in the background.
  $scope.finishedUploadingCartItems = false;
  fmaCartHelper.clearCartThenUpdateCartPromise($scope.itemDetailsFound, $scope.rawAccessToken)
  .then(
    function(res) {
      // In this case, we uploaded all the cart items to delivery.com successfully.
      $scope.finishedUploadingCartItems = true;
    },
    function(err) {
      // In this, someof the items in the cart didn't get uploaded, which is very
      // bad and should never happen.
      mainViewObj.removeClass();
      mainViewObj.addClass('slide-right');
      $location.path('/cart_page');
      return;
    }
  );

}]);
