/*jshint eqnull: true */
angular.module('foodMeApp.addPhone', ['ngRoute', 'foodmeApp.localStorage', 'foodmeApp.sharedState', 'foodmeApp.cartHelper'])

.controller('AddPhoneCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout", "$q", "$route", "fmaCartHelper",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout, $q, $route, fmaCartHelper) {
  var mainViewObj = $('#main_view_container');
  console.log('In add_phone controller.');
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

    alert('In order to choose a card, we need you to log in first.');
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
    $location.path('/home_page_v2/cart_page_v2');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  if ($scope.userAddress == null) {
    analytics.trackEvent('reroute', 'choose_card__choose_address');

    alert('We need to get an address from you first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/home_page_v2/swipe_page_v2');
    return;
  }
  $scope.cardSelected = fmaLocalStorage.getObject('cardSelected');
  if ($scope.cardSelected == null) {
    analytics.trackEvent('reroute', 'add_phone__choose_card');

    alert('We need to get an address from you first.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/choose_card');
    return;
  }
  // After this, we should have an address, a card, a cart full of items,
  // and a token.

  $scope.enterPhoneCancelPressed = function() {
    console.log('Enter phone cancel.');
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-right');
    $location.path('/choose_card');    
  };

  var applyDealCodePromise = function(dealCode, merchantId) {
    return $q(function(resolve, reject) {
      if (dealCode == null) {
        reject('No code.');
      }
      $http({
        method: 'POST',
        url: fmaSharedState.endpoint + '/customer/promo/deal',
        data: {
          deal_code: dealCode,
          merchant_id: merchantId,
          client_id: fmaSharedState.client_id,
        },
        headers: {
          "Authorization": $scope.rawAccessToken,
          "Content-Type": "application/json",
        }
      }).then(
        function(res) {
          resolve(res);
        },
        function(err) {
          reject(err);
        }
      );
    });
  };

  var checkoutEachMerchantSequentially = function(merchantIds, cardSelected, merchantIndex) {
    return $q(function(resolve, reject) {
      if (merchantIds.length === merchantIndex) {
        resolve('Phew! We made it!');
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
          if ($scope.deal != null && $scope.deal.id != null) {
            // Apply a deal code.
            dataObj.payments.push({
              type: "promo",
              id: $scope.deal.id,
            });
            // Invalidate the deal so we don't try to use it on another merchant.
            $scope.deal = null;
          }
          dataObj.merchant_id = merchantId;
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
      console.log(Object.keys(uniqueMerchantIdsObject));
      checkoutEachMerchantSequentially(Object.keys(uniqueMerchantIdsObject), $scope.cardSelected, 0)
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

          console.log('Tracking address.');
          analytics.trackEvent('address_ordered',
                               fmaSharedState.addressToString($scope.userAddress) +
                               '__' + $scope.userAddress.phone + '__' +
                               $scope.userAddress.unit_number + '__' +
                               fmaSharedState.testModeEnabled);
          
          // Go back to the address page.
          mainViewObj.removeClass();
          mainViewObj.addClass('slide-right');
          $location.path('/home_page_v2/swipe_page_v2');
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

  var doAllCheckoutThings = function() {
    console.log('Doing all checkout things, sir!');

    var foodNames = [];
    var sum = 0.0;
    for (var v1 = 0; v1 < $scope.userCart.length; v1++) {
      foodNames.push($scope.userCart[v1].name + ': $' + $scope.userCart[v1].price);
      sum += parseFloat($scope.userCart[v1].price);
    }
    // Update the deal.
    var confirmationString = "Ready to order the following to " +
        fmaSharedState.addressToString($scope.userAddress) +
        "?\n\n" + foodNames.join('\n') +
        '\n\nFor a total of: $';
    if ($scope.deal != null && $scope.deal.reward != null &&
        $scope.deal.reward === 'dollar_off' && $scope.deal.value != null) {
      // Process dollars off an order.
      confirmationString = 'Your deal worked! You\'re getting $' +
          $scope.deal.value.toFixed(2) + ' off of your order :)\n\n' +
          confirmationString +
          sum.toFixed(2) + ' - $' +
          $scope.deal.value.toFixed(2) + ' = $' +
          (sum - $scope.deal.value).toFixed(2) + '?';
    } else if ($scope.deal != null && $scope.deal.reward != null &&
        $scope.deal.reward === 'percent_off' && $scope.deal.value != null) {
      // Process percent off an order.
      confirmationString = 'Your deal worked! You\'re getting ' +
          $scope.deal.value.toFixed(0) + '% off of your order :)\n\n' +
          confirmationString +
          sum.toFixed(2) + ' - $' +
          (sum * $scope.deal.value / 100.0).toFixed(2) + ' = $' +
          (sum * (100.0-$scope.deal.value) / 100.0).toFixed(2) + '?';
    } else if ($scope.deal != null && $scope.deal.reward != null &&
        $scope.deal.reward === 'points' && $scope.deal.value != null) {
      // Process points with an order.
      confirmationString = 'Your deal worked! You\'re getting ' +
          $scope.deal.value + ' points with your order :)\n\n' +
          confirmationString +
          sum.toFixed(2) + '?';
    } else {
      // Process order with no deals.
      confirmationString += sum.toFixed(2) + '?';
    }

    if (fmaSharedState.testModeEnabled) {
      // In test mode, take the money without confirmation so we can test in the
      // browser.
      alert(confirmationString);
      takeMoneyAndFinish();
    } else {
      confirm(confirmationString,
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

  $scope.missingAddressData = {
    phoneNumber: $scope.userAddress.phone,
    apartmentNumber: $scope.userAddress.unit_number,
    promoCode: null,
  };
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

        // Set the address and save it.
        $scope.userAddress = dataObj;
        $scope.userAddress.location_id = res.data.location.location_id;

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
          return fmaSharedState.addressToString(item) !== fmaSharedState.addressToString($scope.userAddress);
        });
        $scope.recentAddresses = [$scope.userAddress,].concat($scope.recentAddresses.slice(0, fmaSharedState.recentAddressesToKeep-1));
        fmaLocalStorage.setObjectWithExpirationSeconds(
            'recentAddresses', $scope.recentAddresses,
            fmaSharedState.testing_invalidation_seconds);

        console.log('Successfully added address.');

        // First try the promo code.
        if ($scope.missingAddressData.promoCode != null &&
            $scope.missingAddressData.promoCode.length > 0) {
          applyDealCodePromise($scope.missingAddressData.promoCode,
              $scope.userCart[0].merchantId)
          .then(
            function(res) {
              // Alert on and factor in the discount.
              $scope.cardsLoading = false;
              $scope.deal = res.data.deal;
              if ($scope.deal == null || $scope.deal.reward == null) {
                alert('Oh no! Your deal didn\'t work :( Try a different code!');
                return;
              }
              doAllCheckoutThings();
              return;
            },
            function(err) {
              // Discount didn't work so don't checkout.
              $scope.cardsLoading = false;
              alert('Oh no! Your deal didn\'t work :( Try a different code?');
              return;
            }
          );
          return;
        }
        $scope.cardsLoading = false;
        doAllCheckoutThings();

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
  };
}]);
