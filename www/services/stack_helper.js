// A utility that fetches data to be shown in the stack. Fetches
// the following things:
//  - allNearbyMerchantData: Basically a response that contains
//    data about all merchants in the vicinity.
//  - foodData: The dishes extracted from allNearbyMerchantData
//    that match the desired cuisines.
//  - foodImageLinks: An object full of links, one for each foodData.
//    Might contain fewer elements than foodData.

/*jshint loopfunc: true */
angular.module('foodMeApp.stackHelper', ['foodmeApp.localStorage', 'foodmeApp.sharedState'])

.factory('fmaStackHelper', ["fmaLocalStorage", "$http", "fmaSharedState", "$q",
function(fmaLocalStorage, $http, fmaSharedState, $q) {
  // This is called if we don't find the merchant and food data in our localStorage.
  var asyncGetMerchantAndFoodData = function(latitude, longitude, token, cuisines) {
    console.log('Asynchronously getting merchant data.');
    // HTTP request to get all the stuff, then process it into a list of food.
    return $q(function(resolve, reject) {
      $http.defaults.headers.common.Authorization = token;
      $http.get(fmaSharedState.endpoint + '/merchant/search/delivery?' + 
                'client_id=' + fmaSharedState.client_id + '&' +
                'latitude=' + latitude + '&' +
                'longitude=' + longitude + '&' +
                'merchant_type=R&' +
                'access_token=' + token
      )
      .then(
      function(res) {
        var allNearbyMerchantData = res.data;
        var foodData = [];
        var merchants = allNearbyMerchantData.merchants;
        var cuisinesOverlap = function(merchantCuisines, cuisines) {
          for (var mCuis = 0; mCuis < merchantCuisines.length; mCuis++) {
            for (var uCuis = 0; uCuis < cuisines.length; uCuis++) {
              if (merchantCuisines[mCuis] == cuisines[uCuis].name) {
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
          if (!cuisinesOverlap(merchantCuisines, cuisines)) {
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
  //
  // Getting images is a heavy-weight operation, so we allow the caller to pass
  // in an foodDataCursor, which tells us what index to start fetching at in
  // foodData.
  var asyncGetFoodImageLinks = function(foodData, foodDataCursor, numPicsToFetch) {
    console.log('Asynchronously getting all the image data.');
    // Sorry the below code is a little confusing-- I'm not a huge fan of
    // Google's API. We actually process the images in searchComplete.
    return $q(function(resolve, reject) { 
      var foodImageLinks = [];
      for (var x = 0; x < numPicsToFetch; x++) {
        // Need a closure to preserve the loop index.
        (function(index) {
          var foodDataObj = foodData[foodDataCursor + index];
          $http.get('https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' +
                    escape(foodDataObj.name) + '&' +
                    'imgsz=small|medium')
          .then(
            function(res) {
              var imageDataList = res.data.responseData.results; 
              var currentLinkObj = {};
              currentLinkObj.index = index;
              currentLinkObj.foodDataId = foodDataObj.id;
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
              currentLinkObj.foodDataId = foodDataObj.id;
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
  var setUpDataVariables = function(latitude, longitude, token, cuisines, numPicsToFetch, forceRefresh) {
    var retVars = {};
    return $q(function(resolve, reject) {
      if (forceRefresh ||
          !fmaLocalStorage.isSet('allNearbyMerchantData') ||
          !fmaLocalStorage.isSet('foodData') ||
          !fmaLocalStorage.isSet('foodImageLinks')) {
        console.log('We need to fetch our data (sadly)');
        // If we're missing any of the necessary data we need to show the cards,
        // just fetch errything.
        asyncGetMerchantAndFoodData(latitude, longitude, token, cuisines).then(
          function(allData) {
            console.log('Got all the merchant and food data!');
            // This is the giant response we get back from delivery.com.
            retVars.allNearbyMerchantData = allData.allNearbyMerchantData;
            // Array of food items, one for each card.
            retVars.foodData = allData.foodData;
            return asyncGetFoodImageLinks(retVars.foodData, 0, 
                Math.min(numPicsToFetch, retVars.foodData.length));
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
            retVars.foodImageLinks = allData.foodImageLinks;                

            // Put everything in localStorage for the future.
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'allNearbyMerchantData', retVars.allNearbyMerchantData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodData', retVars.foodData,
                fmaSharedState.testing_invalidation_seconds);
            fmaLocalStorage.setObjectWithExpirationSeconds(
                'foodImageLinks', retVars.foodImageLinks,
                fmaSharedState.testing_invalidation_seconds);

            // Now we can continue with the rest of the setup.
            resolve(retVars);
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
        retVars.allNearbyMerchantData = fmaLocalStorage.getObject('allNearbyMerchantData');
        // Array of food items, one for each card.
        retVars.foodData = fmaLocalStorage.getObject('foodData');
        // Array of objects with images in them, one for each card.
        retVars.foodImageLinks = fmaLocalStorage.getObject('foodImageLinks');
        
        // Now we can continue with the rest of the setup.
        resolve(retVars);
      } 
    });
  };

  return {
    setUpDataVariables: setUpDataVariables,
    asyncGetFoodImageLinks: asyncGetFoodImageLinks,
  };
}]);
