/*jshint eqnull: true */
angular.module('foodMeApp.chooseCard', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodmeApp.cartHelper'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_card', {
    templateUrl: 'choose_card/choose_card.html',
    controller: 'ChooseCardCtrl'
  });
}])

.controller('ChooseCardCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$route", "fmaCartHelper",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $route, fmaCartHelper) {
  var mainViewObj = $('#main_view_container');
  if (fmaSharedState.testModeEnabled) {
    alert('Warning-- you are using the sandbox.');
  }

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
    analytics.trackEvent('reroute', 'choose_card__intro_screen');

    alert('In order to choose an address, we need you to log in first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/accounts_page');
    return;
  }
  $scope.userCart = fmaLocalStorage.getObject('userCart');
  if ($scope.userCart == null || $scope.userCart.length === 0) {
    analytics.trackEvent('reroute', 'choose_card__cart_page');

    // We redirect to the cart page if the cart is empty.
    alert('We need something in your cart first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/cart_page');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  if ($scope.userAddress == null) {
    analytics.trackEvent('reroute', 'choose_card__choose_address');

    alert('We need to get an address from you first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/choose_address_v2');
    return;
  }
  // If we get here, we have a valid user token AND userCart is nonempty AND
  // userAddress is populated (though may still need phone and apartment).

  analytics.trackView('/choose_card');

  $scope.cardsLoading = true;
  var loadStartTime = (new Date()).getTime();
  $scope.cardList = [];
  $scope.selectedCardIndex = { value: null };
  $http({
    method: 'GET',
    url: fmaSharedState.endpoint+'/customer/cc?client_id=' + fmaSharedState.client_id,
    headers: {
      'Authorization': $scope.rawAccessToken,
    }
  })
  .then(
    function(res) {
      $scope.cardList = res.data.cards;
      // Go through and fix up all of the exp_months to add padding.
      for (var i = 0; i < $scope.cardList.length; i++) {
        var cardInList = $scope.cardList[i];
        var pretty_exp_month = '' + cardInList.exp_month;
        if (pretty_exp_month.length === 1) {
          pretty_exp_month = '0' + pretty_exp_month;
        }
        cardInList.pretty_exp_month = pretty_exp_month;
      }
      // Make the loading last at least a second.
      var timePassedMs = (new Date()).getTime() - loadStartTime;
      $timeout(function() {
        $scope.cardsLoading = false;
      }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
    },
    function(err) {
      alert('Error fetching credit card numbers. This usually happens '+
            'when you login to delivery.com outside of FoodMe. Just re-add ' +
            'this account on the accounts page and '+
            'everything should be fiiine.');
      console.log(err);
      $scope.cardsLoading = false;
      return;
  });

  $scope.chooseCardBackPressed = function() {
    analytics.trackEvent('nav', 'choose_card__back_pressed');

    console.log('Back button pressed.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('accounts_page');
    return;
  };

  var checkoutEachMerchantSequentially = function(merchantIds, cardSelected, merchantIndex) {
    return $q(function(resolve, reject) {
      if (merchantIds.length === merchantIndex) {
        return resolve('Phew! We made it!');
      }
      // Sigh.. before we checkout for a merchant we need to re-add everything
      // to the cart because shitty delivery.com clears the cart every time.
      var merchantId = merchantIds[merchantIndex];
      fmaCartHelper.clearCartThenUpdateCartPromise($scope.userCart, $scope.rawAccessToken, merchantId)
      .then(
        function(newCartItems) {
          console.log('Checking out for merchant id: ' + merchantId);
          var dataObj = {
            tip: fmaSharedState.tipAmount,
            location_id: $scope.userAddress.location_id,
            uhau_id: fmaSharedState.uhau_id,
            instructions: "Tell people to download the FoodMe app and you'll get more orders!",
            payments: [{
              type: "credit_card",
              id: cardSelected.cc_id,
            }],
            order_type: "delivery",
            order_time: 'ASAP',
          };
          $http({
            method: 'POST',
            url: fmaSharedState.endpoint + '/customer/cart/'+merchantId+'/checkout?client_id=' + fmaSharedState.client_id,
            data: dataObj,
            headers: {
              "Authorization": $scope.rawAccessToken,
              "Content-Type": "application/json",
            }
          }).then(
            function(res) {
              checkoutEachMerchantSequentially(merchantIds, cardSelected, merchantIndex + 1)
              .then(
                function(res) {
                  return resolve(res);
                },
                function(err) {
                  return reject(err);
                }
              );
            },
            function(err) {
              return reject(err);
            }
          );
        },
        function(newCartItems) {
          reject({data: {message: [{user_msg: 'Doh! Some of the merchants ' +
              'selling the items in your cart just closed. Just go back and ' +
              'add some more things-- this happens rarely, I promise!'}]}});
        }
      );
    });
  };

  // This is probably the most critical piece of code in the whole app.
  // It's where we place an order and charge the card.
  var processPaymentPromise = function() {
    if (!fmaSharedState.takePayment) {
      return $q(function(resolve, reject) {
        alert('Not actually taking your money.');
        resolve('Not actually taking money');
      });
    }
    // Everything below here only executes if fmaSharedState.takePayment = true.
    
    console.log('About to take money!');
    return $q(function(resolve, reject) {
      var uniqueMerchantIdsObject = {};
      for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
        var cartItem = $scope.userCart[v1];
        uniqueMerchantIdsObject[cartItem.merchantId] = true;
      }
      var cardSelected = $scope.cardList[$scope.selectedCardIndex.value];
      console.log(Object.keys(uniqueMerchantIdsObject));
      checkoutEachMerchantSequentially(Object.keys(uniqueMerchantIdsObject), cardSelected, 0)
      .then(
        function(res) {
          resolve(res);
        },
        function(err) {
          reject(err);
        }
      );
    });
  };

  var takeMoneyAndFinish = function() {
    $scope.cardsLoading = true;
    var loadStartTime = (new Date()).getTime();
    processPaymentPromise()
    .then(
      function(res) {
        analytics.trackEvent('purchase', 'choose_card__order_success');

        // We were successful in processing the payment!
        console.log('Successfully processed order!');

        // Make the loading last at least a second.
        var timePassedMs = (new Date()).getTime() - loadStartTime;
        analytics.trackTiming('purchase', timePassedMs, 'card_page__order_success');
        $timeout(function() {
          $scope.cardsLoading = false;
          alert("Thanks! I just took your money and your order will arrive in less " +
                "than half an hour. Unless it doesn't. It probably will, though, " +
                "maybe.");

          // Clear the user's cart.
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'userCart', null,
              fmaSharedState.testing_invalidation_seconds);
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'foodData', null,
              fmaSharedState.testing_invalidation_seconds);

          // Log the transaction with Google analytics.
          var sum = 0.0;
          var concatenatedName = '';
          for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
            sum += parseFloat($scope.userCart[v1].price);
            concatenatedName += ($scope.userCart[v1].name + '__');
          }
          concatenatedName += (new Date()).getTime() + '__';
          concatenatedName += fmaSharedState.testModeEnabled;
          analytics.addTransaction(concatenatedName, 'foodme', sum, 0.0,
              0.0, 'USD');
          analytics.addTransactionItem(concatenatedName, concatenatedName,
              concatenatedName, 'food_purchase', sum, 1.0, 'USD');

          // Add the orders to our recent orders.
          $scope.recentOrders = fmaLocalStorage.getObject('recentOrders');
          if ($scope.recentOrders == null) {
            $scope.recentOrders = [];
          }
          for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
            var currentItem = $scope.userCart[v1];
            $scope.recentOrders = _.filter($scope.recentOrders, function(item) {
              return item.unique_key !== currentItem.unique_key;
            });
            $scope.recentOrders = [currentItem,].concat($scope.recentOrders.slice(0, fmaSharedState.recentOrdersToKeep-1));
          }
          fmaLocalStorage.setObjectWithExpirationSeconds(
              'recentOrders', $scope.recentOrders,
              fmaSharedState.testing_invalidation_seconds);
          
          // Go back to the address page.
          mainViewObj.removeClass();
          mainViewObj.addClass('slide-right');
          $location.path('/choose_address_v2');
        }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
      },
      function(err) {
        analytics.trackEvent('purchase', 'choose_card__order_failure');

        // Make the loading last at least a second.
        var timePassedMs = (new Date()).getTime() - loadStartTime;
        analytics.trackTiming('purchase', timePassedMs, 'card_page__order_failure');
        $timeout(function() {
          $scope.cardsLoading = false;
          var error_str = '...';
          if (err != null && err.data != null && err.data.message != null &&
              err.data.message.length > 0) {
            error_str = err.data.message[0].user_msg;
          }
          alert("Huh.. we had a problem with your payment: " + error_str +
                " The best thing to do is probably just to clear out your " +
                "cart and try again. It shouldn't happen twice.");
        }, Math.max(fmaSharedState.minLoadingMs - timePassedMs, 0));
      }
    );
  };

  $scope.missingAddressData = {
    phoneNumber: null,
    apartmentNumber: null,
  }
  $scope.enterPhoneCancelPressed = function() {
    console.log('Enter phone cancel.');
    $scope.showPhonePage = false;
  }

  $scope.enterPhoneDonePressed = function() {
    console.log('Enter phone done!');

    if ($scope.missingAddressData.phoneNumber == null ||
        $scope.missingAddressData.phoneNumber.length === 0) {
      alert('You have to enter a phone number, dude.');
      return;
    }

    $scope.cardsLoading = true;
    $scope.missingAddressData.phoneNumber =
        $scope.missingAddressData.phoneNumber.replace(/[- )(a-zA-Z]/g,'');

    // Set up the new address
    var dataObj = {
      street: $scope.userAddress.street,
      city: $scope.userAddress.city,
      state: $scope.userAddress.state,
      zip_code: $scope.userAddress.zip_code,
      phone: $scope.missingAddressData.phoneNumber,
      unit_number: $scope.missingAddressData.apartmentNumber,
    };
    $http({
      method: 'POST',
      url: fmaSharedState.endpoint + '/customer/location?client_id=' + fmaSharedState.client_id,
      data: dataObj,
      headers: {
        "Authorization": $scope.rawAccessToken,
        "Content-Type": "application/json",
      }
    })
    .then(
      function(res) {
        analytics.trackEvent('nav', 'add_address__done_pressed__success');
        $scope.cardsLoading = false;

        // Set the address and save it.
        $scope.userAddress = dataObj;
        fmaLocalStorage.setObjectWithExpirationSeconds(
            'userAddress', $scope.userAddress,
            fmaSharedState.testing_invalidation_seconds);

        // Update recentAddresses too.
        $scope.recentAddresses = fmaLocalStorage.getObject('recentAddresses');
        if ($scope.recentAddresses == null) {
          $scope.recentAddresses = [];
        }
        // Add the address to the recent addresses so it has the phone attached now.
        $scope.recentAddresses = _.filter($scope.recentAddresses, function(item) {
          return fmaSharedState.addressToString(item) !== fmaSharedState.addressToString($scope.userAddress)
        });
        $scope.recentAddresses = [$scope.userAddress,].concat($scope.recentAddresses.slice(0, fmaSharedState.recentAddressesToKeep-1));
        fmaLocalStorage.setObjectWithExpirationSeconds(
            'recentAddresses', $scope.recentAddresses,
            fmaSharedState.testing_invalidation_seconds);
        

        console.log('Successfully added address.');
        $scope.showPhonePage = false;
        $scope.chooseCardFinishPressed();
        return;
      },
      function(err) {
        $scope.cardsLoading = false;
        console.log('Error adding address.');
        if (!err.data.message || err.data.message.length === 0) {
          analytics.trackEvent('nav', 'add_address__done_pressed__failure', 'weird_failure');
          alert("A weeeird error occurred. Going to be real with you here-- " +
                "not quite sure what happened but it's probably a " +
                "connectivity issue, which isn't my fault.");
          return;
        }
        alert(err.data.message[0].user_msg);

        return;
    });
  }

  var doAllCheckoutThings = function() {
    console.log('Doing all checkout things, sir!');
    var foodNames = [];
    var sum = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      foodNames.push($scope.userCart[v1].name + ': $' + $scope.userCart[v1].price);
      sum += parseFloat($scope.userCart[v1].price);
    }
    if (fmaSharedState.testModeEnabled) {
      // In test mode, take the money without confirmation so we can test in the
      // browser.
      takeMoneyAndFinish();
    } else {
      confirm("Ready to order the following to " + fmaSharedState.addressToString($scope.userAddress) +
              "?\n\n" + foodNames.join('\n') +
              '\n\nFor a total of: $' + sum.toFixed(2) + '?',
        function(index) {
          if (index === 1) {
            // Track this purchase.
            analytics.trackEvent('purchase', 'choose_card__confirmed_purchase');
            console.log('Order confirmed!');

            takeMoneyAndFinish();
          }
        }
      );
    }
    return;
  };

  $scope.chooseCardFinishPressed = function() {
    analytics.trackEvent('nav', 'choose_card__finish_pressed');

    console.log('Finish button pressed.');

    if ($scope.selectedCardIndex.value == null) {
      alert("SELECT A CARD. DO AS I SAY.");
      return;
    }

    if ($scope.userAddress.phone == null) {
      $scope.showPhonePage = true;
      return;      
    }

    // Sigh.. we have to check the address first...
    $scope.cardsLoading = true;
    $http({
      method: 'POST',
      url: fmaSharedState.endpoint + '/customer/location?client_id=' + fmaSharedState.client_id,
      data: $scope.userAddress,
      headers: {
        "Authorization": $scope.rawAccessToken,
        "Content-Type": "application/json",
      }
    })
    .then(
      function(res) {
        analytics.trackEvent('nav', 'add_address__done_pressed__success');
        $scope.cardsLoading = false;
        // We need to grab the location_id because it's a part of checkout.
        $scope.userAddress.location_id = res.data.location.location_id;
        doAllCheckoutThings();
        return;
      },
      function(err) {
        $scope.cardsLoading = false;
        console.log('Error checking address.');
        if (!err.data.message || err.data.message.length === 0) {
          analytics.trackEvent('nav', 'add_address__done_pressed__failure', 'weird_failure');
          alert("A weeeird error occurred. Going to be real with you here-- " +
                "not quite sure what happened but it's probably a " +
                "connectivity issue, which isn't my fault.");
          return;
        }
        alert("Hmm.. we had an issue with your address: " + err.data.message[0].user_msg +
              " You may have to go back to the address page" +
              "and fix this before you can checkout. But don't worry, all your " +
              "information (including your cart) will be here waiting.");

        return;
    });
    return;
  };

  // Set the selected location index when a user taps a cell.
  $scope.cellSelected = function(indexSelected) {
    analytics.trackEvent('cell', 'choose_card__cell_selected');

    console.log('Cell selected: ' + indexSelected);
    $scope.selectedCardIndex.value = indexSelected;
  };

  $scope.addCardButtonPressed = function() {
    analytics.trackEvent('cell', 'choose_card__add_card_pressed');

    console.log('Add card pressed!');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/add_card');
    return;
  };

}]);
