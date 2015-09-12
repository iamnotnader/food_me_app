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

  analytics.trackView('/choose_address_v2');
  $scope.recentAddresses = fmaLocalStorage.getObject('recentAddresses');
  if ($scope.recentAddresses == null) {
    $scope.recentAddresses = [];
  }

  var addressObjFromFormattedAddress = function(formatted_address) {
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

  var initAddressWithLocation = function() {
    navigator.geolocation.getCurrentPosition(function(locSucc) {
      var lattitude = locSucc.coords.latitude;
      var longitude = locSucc.coords.longitude;
      $http.get('https://maps.googleapis.com/maps/api/geocode/json?latlng='+lattitude+','+longitude)
      .then(
        function(res) {
          if ($scope.query != '' ||
              res.data.results == null || res.data.results.length === 0 ||
              res.data.results[0].formatted_address == null) {
            return;
          }
          $scope.userAddress = addressObjFromFormattedAddress(res.data.results[0].formatted_address);
          if ($scope.userAddress == null) {
            return;
          }
          var addressAsString = fmaSharedState.addressToString($scope.userAddress)
          $scope.query = addressAsString;
          $scope.selectedLocationIndex = { value: null };
        },
        function(err) {
          console.log('Location stuff didn\'t really work.');
        }
      );
    },
    function(locErr) {
      console.log('ERROR WITH LOCATION');
    });
  }

  $scope.userAddress = null;
  function initAutocomplete() {
    // Create the autocomplete object, restricting the search to geographical
    // location types.
    autocomplete = new google.maps.places.Autocomplete(
        /** @type {!HTMLInputElement} */(document.getElementById('choose_address_v2__autocomplete')),
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

    $scope.userAddress = addressObjFromFormattedAddress(place.formatted_address);
    if ($scope.userAddress == null) {
      console.log('WTF! Couldn\'t parse address...');
      alert('I had trouble parsing that address-- could you try ' +
            'a slightly different one?');
      return;
    }

    var addressAsString = fmaSharedState.addressToString($scope.userAddress)
    $('#choose_address_v2__autocomplete').val(addressAsString)
    $scope.$apply(function() {
      $scope.query = addressAsString;
      $scope.selectedLocationIndex = { value: null };
    });
  }

  // Bias the autocomplete object to the user's geographical location,
  // as supplied by the browser's 'navigator.geolocation' object.
  // Called in the input field.
  function geolocate() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        var geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        var circle = new google.maps.Circle({
          center: geolocation,
          radius: position.coords.accuracy
        });
        autocomplete.setBounds(circle.getBounds());
      });
    }
  }

  // Prepopulate with location.
  $scope.inputChanged = function(query) {
    $scope.userAddress = null;
    navigator.geolocation.getCurrentPosition(function(locSucc) {
      var lattitude = locSucc.coords.latitude;
      var longitude = locSucc.coords.longitude;
    },
    function(locErr) {
      console.log('ERROR WITH LOCATION');
    });
                             //[geolocationError],
                                         //[geolocationOptions]);
  };

  $scope.clearTextPressed = function() {
    $('#choose_address_v2__autocomplete').val('');
  };

  $scope.selectedLocationIndex = { value: null };
  $scope.cellSelected = function(addressIndex) {
    $scope.selectedLocationIndex.value = addressIndex;
    $scope.userAddress = $scope.recentAddresses[addressIndex];
    $scope.query = fmaSharedState.addressToString($scope.userAddress);
  }

  $scope.doneButtonPressed = function() {
    analytics.trackEvent('nav', 'choose_address_v2__done_pressed');
    console.log('Done button pressed.');
    if ($scope.userAddress == null) {
      console.log('No address entered yet.');
      alert('Tell us where you live, bro. And make sure you select your address from the dropdown.');
      return;
    }
    console.log('Saving address.');
    // Save the address.
    fmaLocalStorage.setObjectWithExpirationSeconds(
        'userAddress', $scope.userAddress,
        fmaSharedState.testing_invalidation_seconds);

    // Add the address to the recent addresses.
    $scope.recentAddresses = _.filter($scope.recentAddresses, function(item) {
      return !angular.equals(item, $scope.userAddress)
    });
    $scope.recentAddresses = [$scope.userAddress,].concat($scope.recentAddresses.slice(0, 4));
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
  initAddressWithLocation();
}]);
