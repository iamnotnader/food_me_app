angular.module('foodMeApp.chooseAddressV3', ['ngRoute', 'ngTouch', 'foodmeApp.localStorage', 'foodmeApp.sharedState'])

.controller('ChooseAddressV3Ctrl', ["$scope", "$location", "fmaLocalStorage", "$http", "fmaSharedState", "$rootScope", "$timeout",
function($scope, $location, fmaLocalStorage, $http, fmaSharedState, $rootScope, $timeout) {

  if ($scope.globals.userAddress != null) {
    $scope.addressQuery = fmaSharedState.addressToString($scope.globals.userAddress);
  }
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

    var addressAsString = fmaSharedState.addressToString(parsedAddressObj);
    $('#choose_address_v2__autocomplete').val(addressAsString);
    $scope.$apply(function() {
      $scope.addressQuery = addressAsString;
    });
    $scope.globals.userAddress = null;
  }

  var placesAutocompleteService = new google.maps.places.AutocompleteService();
  var placesVanillaService = new google.maps.places.PlacesService(
      document.getElementById('dummy_google_attribution_element'));
  $scope.predictedAddresses = { data: [] };
  var handlePredictions = function(pred, status) {
    if (pred == null) {
      alert("We're having trouble fetching addresses. Is your connection spotty?");
      return;
    }
    // Reset the predictedAddresses field.
    $scope.predictedAddresses.data = pred;
  };
  $scope.addressDidChange = function() {
    if ($scope.addressQuery == null ||
        $scope.addressQuery == '') {
      $scope.predictedAddresses.data = [];
      return;
    }
    //perform request. limit results to Australia
    var placesRequest = {
      input: $scope.addressQuery,
      types: ['address'],
      componentRestrictions: { country: "us" }
    };
    placesAutocompleteService.getPlacePredictions(placesRequest, handlePredictions);
  };

  var addressObjFromGoogleFormattedAddress = function(formatted_address) {
    if (formatted_address == null) {
      alert('Oh no! That address messed up. Can you pick a different one?');
    }
    components = formatted_address.split(',');
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
  };
  var handleChosenAddress = function(full_place, status) {
    if (full_place == null || full_place.formatted_address == null) {
      alert('Oh no! That address messed up. Can you pick a different one?');
      return;
    }
    var addressObj = addressObjFromGoogleFormattedAddress(full_place.formatted_address);
    if (addressObj == null) {
      alert('Oh no! That address messed up. Can you pick a different one?');
    }
    var addressAsString = fmaSharedState.addressToString(addressObj);
    $scope.globals.userAddress = addressObj;
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', $scope.globals.userAddress,
        fmaSharedState.testing_invalidation_seconds);
    $scope.$apply(function() {
      $scope.predictedAddresses.data = [];
      $scope.addressQuery = addressAsString;
    });
  };
  $scope.addressSelected = function(addressChosen) {
    if (addressChosen == null || addressChosen.id == null) {
      return;
    }
    placesVanillaService.getDetails({placeId: addressChosen.place_id}, handleChosenAddress);
  };

  $scope.clearTextPressed = function() {
    $scope.addressQuery = '';
    $scope.predictedAddresses.data = [];
    $scope.globals.userAddress = null;
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', null,
        fmaSharedState.testing_invalidation_seconds);
    $scope.globals.userCart = [];
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userCart', null,
        fmaSharedState.testing_invalidation_seconds);
    $scope.globals.minimumLeft = null;
  };
}]);
