angular.module('foodmeApp.localStorage', [])

.factory('fmaLocalStorage', ['$window', function($window) {
  var getObjectFunc =  function(key) {
    var itemFound = JSON.parse($window.localStorage[key] || 'null');
    if (itemFound == null) { return null; }

    // The object exists; check to see if it's expired.
    if (itemFound.expirationTime != null &&
        (new Date().getTime() > new Date(itemFound.expirationTime).getTime())) {
      return null;
    }

    var value = itemFound.value;
    if (value == null) { return null; }

    return value;
  };
  return {
    setObject: function(key, value) {
      $window.localStorage[key] = JSON.stringify({
        value: value,
      });
    },
    setObjectWithExpirationSeconds: function(key, value, secondsUntilExpiration) {
      var now = new Date();
      now.setUTCSeconds(now.getUTCSeconds() + secondsUntilExpiration);
      $window.localStorage[key] = JSON.stringify({
        value: value,
        expirationTime: now,
      });
    },
    getObject: getObjectFunc,
    isSet: function(key) {
      return getObjectFunc(key) != null;
    }
  };
}]);
