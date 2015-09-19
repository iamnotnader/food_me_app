angular.module('foodMeApp.chooseAddressV2', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/choose_address_v2', {
    templateUrl: 'choose_address_v2/choose_address_v2.html',
    controller: 'ChooseAddressV2Ctrl'
  });
}])

.controller('ChooseAddressV2Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {
  var mainViewObj = $('#main_view_container');

  if (fmaSharedState.testModeEnabled) {
    alert('Warning-- you are using the sandbox.');
  }

  analytics.trackView('/choose_address_v2');
  $scope.recentAddresses = fmaLocalStorage.getObject('recentAddresses');
  if ($scope.recentAddresses == null) {
    $scope.recentAddresses = [];
  }

  var addressObjFromGoogleFormattedAddress = function(formatted_address) {
    components = formatted_address.split(',')
    if (components.length < 4 || components[2].split(' ').length < 3) {
      return null;
    }
    components[2] = components[2].split(' ');
    return {
      street: components[0],
      city: components[1],
      state: components[2][1],
      zip_code: components[2][2],
      phone: null,
      unit_number: null,
    };
  }

  $scope.userAddress = null;
  function initAutocomplete() {
    // Create the autocomplete object, restricting the search to geographical
    // location types.
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('choose_address_v2__autocomplete'),
        {
          types: ['address'],
          componentRestrictions: { country: "us" }
        });

    // When the user selects an address from the dropdown, populate the address
    // fields in the form.
    autocomplete.addListener('place_changed', fillInAddress);
  }

  function fillInAddress() {
    // Get the place details from the autocomplete object.
    var place = autocomplete.getPlace();

    parsedAddressObj = addressObjFromGoogleFormattedAddress(place.formatted_address);
    if (parsedAddressObj == null) {
      console.log('WTF! Couldn\'t parse address...');
      alert('I had trouble parsing that address-- could you try ' +
            'a slightly different one?');
      return;
    }

    var addressAsString = fmaSharedState.addressToString(parsedAddressObj)
    $('#choose_address_v2__autocomplete').val(addressAsString)
    $scope.$apply(function() {
      $scope.query = addressAsString;
      $scope.selectedLocationIndex = { value: null };
    });
    $scope.userAddress = null;
  }

  $scope.addressDidChange = function() {
    // Null out the location index whenever the address changes.
    $scope.selectedLocationIndex = { value: null };
  }

  $scope.clearTextPressed = function() {
    $('#choose_address_v2__autocomplete').val('');
    $scope.userAddress = null;
    $scope.selectedLocationIndex = { value: null };
  };

  $scope.selectedLocationIndex = { value: null };
  $scope.cellSelected = function(addressIndex) {
    $scope.selectedLocationIndex.value = addressIndex;
    $scope.userAddress = $scope.recentAddresses[addressIndex];
    $scope.query = fmaSharedState.addressToString($scope.userAddress);
  }

  var getAddressObjFromTextBoxString = function(textBoxString) {
    if (textBoxString == null) {
      return null;
    }
    var addressParts = textBoxString.split(/,\s*/);
    if (addressParts.length !== 4) {
      return null;
    }
    return {
      street: addressParts[0],
      city: addressParts[1],
      state: addressParts[2],
      zip_code: addressParts[3],
      phone: null,
      unit_number: null,
    };
  }

  $scope.doneButtonPressed = function() {
    analytics.trackEvent('nav', 'choose_address_v2__done_pressed');
    console.log('Done button pressed.');

    var textBoxAddressObj = getAddressObjFromTextBoxString($scope.query);
    if ($scope.userAddress == null && textBoxAddressObj == null) {
      console.log('No address entered yet.');
      alert('Tell us where you live, bro. And make sure you use the following format: "street, city, state, zip".');
      return;
    } else if ($scope.userAddress == null) {
      $scope.userAddress = textBoxAddressObj;
    }
    console.log('Saving address.');
    // Save the address.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', $scope.userAddress,
        fmaSharedState.testing_invalidation_seconds);

    // Add the address to the recent addresses.
    $scope.recentAddresses = _.filter($scope.recentAddresses, function(item) {
      return fmaSharedState.addressToString(item) !== fmaSharedState.addressToString($scope.userAddress)
    });
    $scope.recentAddresses = [$scope.userAddress,].concat($scope.recentAddresses.slice(0, fmaSharedState.recentAddressesToKeep-1));
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'recentAddresses', $scope.recentAddresses,
        fmaSharedState.testing_invalidation_seconds);
    mainViewObj.removeClass();
    mainViewObj.addClass('slide-left');
    $location.path('/choose_cuisine');
    return;
  };

  // Init some things.
  initAutocomplete();
}]);
