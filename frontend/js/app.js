
angular.module('yjsEditor', ['op.live-conference'])
.directive('liveConferenceEditorController', [function() {
    function controller($scope) {
      $scope.editorVisible = false;
      $scope.quill = false;
      $scope.showEditor = function() {
        var percent = 70;
        if ($scope.editorVisible) {
          $('#multiparty-conference').css('width', '100%');
          $('#editor-wrapper').css({
            display: 'none',
            width: percent+'%'}
          );
        }
        else {
          $('#multiparty-conference').css('width', (100-percent)+'%');
          $('#editor-wrapper').css('display', 'block');
        }
        $scope.editorVisible = !$scope.editorVisible;

        if ($scope.quill === false) {
          console.log('Creating editor instance');
          $scope.quill = new Quill('#editor',{
            modules: {
              'multi-cursor': true,
              'link-tooltip': true,
              'image-tooltip': true,
              'toolbar': {container: '#toolbar'}
            },
            theme: 'snow'
          });
        }
      };
    }
    return {
      restrict: 'A',
      require: 'liveConference',
      controller: controller
    }
  }]).directive('liveConferenceEditor', [function() {
    function controller($scope) {
      $scope.colors = ['red', 'green', 'blue', 'yellow', 'black', 'white'];
    };

    return {
      controller: controller,
      restrict: 'E',
      replace: 'true',
      templateUrl: '/yjs/views/editor.html'
    };
  }]).directive('editorTogglerElement', [
    function() {
    return {
      restrict: 'E',
      require: 'liveConference',
      replace: 'true',
      template: '<li live-conference-editor-controller><a href="" ng-click="toggleEditor()">ToggleEditor</a></li>'
    }
  }]);