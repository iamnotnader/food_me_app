/*jshint loopfunc: true */
angular.module('foodMeApp.swipePage', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/swipe_page', {
    templateUrl: 'swipe_page/swipe_page.html',
    controller: 'SwipePageCtrl'
  });
}])

.controller('SwipePageCtrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$q",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $q) {
  // For this page, we need a token, an address, and some chosen cuisines. If we
  // are missing any of these, then we redirect to the proper page to get them.
  console.log('In swipe_page controller.');
  $scope.userToken = fmaLocalStorage.getObject('userToken');
  $scope.rawAccessToken = null;
  if (fmaSharedState.fake_token) {
    alert('Warning-- you are using a fake access token.');
    console.log('Fake token being used.');
    $scope.rawAccessToken = fmaSharedState.fake_token;
  } else if (_.has($scope.userToken, 'access_token')) {
    console.log('Stored token being used.');
    $scope.rawAccessToken = $scope.userToken.access_token;
  }
  if ($scope.rawAccessToken === null) {
    alert('In order to swipe, we need you to log in first.');
    console.log('No token found-- go back to intro_screen.');
    $location.path('/intro_screen');
    return;
  }
  if (!fmaLocalStorage.isSet('userAddress')) {
    alert("In order to swipe, we need an address and some cuisines first.");
    console.log('No address found-- go back to choose_address to get it.');
    $location.path('/choose_address');
    return;
  }
  if (!fmaLocalStorage.isSet('userCuisines')) {
    alert("In order to swipe, we need some cuisines first.");
    console.log('No cuisines. Go back to choose_cuisine.');
    $location.path('/choose_cuisine');
    return;
  }
  $scope.userAddress = fmaLocalStorage.getObject('userAddress');
  $scope.userCuisines = fmaLocalStorage.getObject('userCuisines');
  // If we get here, we have a token, an address, and some chosen cuisines.

  
  // This is called if we don't find the merchant and food data in our localStorage.
  var asyncGetMerchantAndFoodData = function() {
    console.log('Asynchronously getting merchant data.');
    // HTTP request to get all the stuff, then process it into a list of food.
    return $q(function(resolve, reject) {
      $http.defaults.headers.common.Authorization = $scope.rawAccessToken;
      $http.get('https://api.delivery.com/merchant/search/delivery?' + 
                'client_id=' + fmaSharedState.client_id + '&' +
                'latitude=' + $scope.userAddress.latitude + '&' +
                'longitude=' + $scope.userAddress.longitude + '&' +
                'merchant_type=R&' +
                'access_token=' + $scope.rawAccessToken
      )
      .then(
      function(res) {
        var allNearbyMerchantData = res.data;
        var foodData = [];
        var merchants = allNearbyMerchantData.merchants;
        var cuisinesOverlap = function(merchantCuisines, userCuisines) {
          for (var mCuis = 0; mCuis < merchantCuisines.length; mCuis++) {
            for (var uCuis = 0; uCuis < userCuisines.length; uCuis++) {
              if (merchantCuisines[mCuis] == userCuisines[uCuis].name) {
                  return true;
              }
            }
          }
        };
        for (var merchId = 0; merchId < merchants.length; merchId++) {
          var currentMerchant = merchants[merchId];
          if (!currentMerchant.ordering.is_open) {
            continue;
          }
          // TODO(securitythreat): Sigh.. this loop is O(mn) where m = merchant
          // cuisines and n = selected cuisines.
          var merchantCuisines = currentMerchant.summary.cuisines;
          if (!cuisinesOverlap(merchantCuisines, $scope.userCuisines)) {
            continue;
          }

          // If we get here, the merchant matches our filters. So we add all of
          // their recommended items to our list of foodData.
          var recommendedItemObj = currentMerchant.summary.recommended_items;
          var recommendedItemIds = Object.keys(recommendedItemObj);
          for (var itemI = 0; itemI < recommendedItemIds.length; itemI++) {
            // Add a few extra details we want to show.
            var currentItem = recommendedItemObj[recommendedItemIds[itemI]];
            currentItem.id = recommendedItemIds[itemI];
            currentItem.name = he.decode(currentItem.name);
            currentItem.merchantName = he.decode(currentMerchant.summary.name);
            currentItem.merchantDescription = currentMerchant.summary.description;
            currentItem.merchantLogo = currentMerchant.summary.merchant_logo;
            currentItem.merchantId = currentMerchant.id;
            currentItem.merchantCuisines = currentMerchant.summary.cuisines;

            // Add the processed item to our foodData list!
            foodData.push(currentItem);
          }
        }

        // Shuffle up the dishes for fun.
        foodData = _.shuffle(foodData);

        // Return all the data (woo!)
        resolve({
          allNearbyMerchantData: allNearbyMerchantData,
          foodData: foodData
        });
      },
      function(err) {
        console.log('Error occurred getting allNearbyMerchantData.');
        console.log(JSON.stringify(err));
        reject(err);
      });
    });
  };

  // This is called if we don't find the image data for each item in localStorage.
  // Will be called AFTER asyncGetMerchantAndFoodData.
  var asyncGetFoodImageLinks = function() {
    console.log('Asynchronously getting all the image data.');
    // Sorry the below code is a little confusing-- I'm not a huge fan of
    // Google's API. We actually process the images in searchComplete.
    return $q(function(resolve, reject) { 
      var numPicsToFetch = Math.min(10, $scope.foodData.length);
      var foodImageLinks = [];
      for (var x = 0; x < numPicsToFetch; x++) {
        // Need a closure to preserve the loop index.
        (function(index) {
          $http.get('https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' +
                    escape($scope.foodData[index].name))
          .then(
            function(res) {
              var imageDataList = res.data.responseData.results; 
              var currentLinkObj = {};
              currentLinkObj.index = index;
              currentLinkObj.foodDataId = $scope.foodData[index].id;
              currentLinkObj.urls = [];
              for (var y = 0; y < imageDataList.length; y++) {
                currentLinkObj.urls.push(unescape(imageDataList[y].url)); 
              } 
              foodImageLinks.push(currentLinkObj);
              if (foodImageLinks.length == numPicsToFetch) {
                foodImageLinks.sort(function(a, b) {
                  return a.index - b.index;
                });
                resolve({foodImageLinks: foodImageLinks});
              }
            },
            function(err) {
              var currentLinkObj = {};
              currentLinkObj.index = index;
              currentLinkObj.foodDataId = $scope.foodData[index].id;
              foodImageLinks.push(currentLinkObj);
              if (foodImageLinks.length == numPicsToFetch) {
                resolve({foodImageLinks: foodImageLinks});
              }
            });
        })(x);
      }
    });
  };

  // Called after we get all of the merchant data AND all of the image data.
  var setUpDataVariables = function(forceRefresh) {
    return $q(function(resolve, reject) {
      if (forceRefresh ||
          !fmaLocalStorage.isSet('allNearbyMerchantData') ||
          !fmaLocalStorage.isSet('foodData') ||
          !fmaLocalStorage.isSet('foodImageLinks')) {
        console.log('We need to fetch our data (sadly)');
        // If we're missing any of the necessary data we need to show the cards,
        // just fetch errything.
        asyncGetMerchantAndFoodData().then(
          function(allData) {
            console.log('Got all the merchant and food data!');
            // This is the giant response we get back from delivery.com.
            $scope.allNearbyMerchantData = allData.allNearbyMerchantData;
            // Array of food items, one for each card.
            $scope.foodData = allData.foodData;
            return asyncGetFoodImageLinks();
          },
          function(err) {
            console.log("Error getting merchant data WTF.");
            console.log(JSON.stringify(err));
            alert("We haad a weird problem. Uh.. try restarting the app.");
            reject(err);
        }).then(
          function(allData) {
            console.log('Got all the image data!');
            // Array of objects with images in them, one for each card.
            $scope.foodImageLinks = allData.foodImageLinks;                

            // Put everything in localStorage for the future.
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'allNearbyMerchantData', $scope.allNearbyMerchantData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodData', $scope.foodData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodImageLinks', $scope.foodImageLinks,
                fmaSharedState.testing_invalidation_seconds);

            // Now we can continue with the rest of the setup.
            resolve({});
          },
          function(err) {
            console.log("Error getting merchant data WTF.");
            console.log(JSON.stringify(err));
            alert("We haad a weird problem. Uh.. try restarting the app.");
            reject(err);
        });
      } else {
        console.log('Got all our data from localstorage (woo!)');
        // In this case, everything is already in the cache already so just get it.

        // This is the giant response we get back from delivery.com.
        $scope.allNearbyMerchantData = fmaLocalStorage.getObject('allNearbyMerchantData');
        // Array of food items, one for each card.
        $scope.foodData = fmaLocalStorage.getObject('foodData');
        // Array of objects with images in them, one for each card.
        $scope.foodImageLinks = fmaLocalStorage.getObject('foodImageLinks');
        
        // Now we can continue with the rest of the setup.
        resolve({});
      } 
    });
  };

  // By the time we reach this function, we are guaranteed to haeve set:
  //  - $scope.allNearbyMerchantData
  //  - $scope.foodData
  //  - $scope.foodImageLinks
  //
  // Furthermore, foodImageLinks will be shorter than foodData, because we only
  // fetch a maximum of 10 sets of images. We do some joining in this function
  // to make it easier to display the results.
  var finalSetup = function() {
    console.log('Yay reached final setup!');
    $scope.joinedFoodInfo = [];
    // Note that foodImageLinks always has fewer items than foodData because we
    // populate it conservatively.
    for (var x = 0; x < $scope.foodImageLinks.length; x++) {
      $scope.joinedFoodInfo.push({
        foodData: $scope.foodData[x],
        imageLinks: $scope.foodImageLinks[x],
      });
    }
  };

  // After loading all the data variables, we do some more setup.
  $scope.isLoading = true;
  setUpDataVariables(false).then(
    function(succ) {
      console.log('Final setup.');
      finalSetup();
      
      $scope.isLoading = false;
    },
    function(err) {
      // Not really sure what to do here.
    } 
  );
}]);
