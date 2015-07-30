'use strict';
/*global chai*/

var expect = chai.expect;
describe('The collaborative debugger', function() {
  var contentsToHtml, $window, $rootScope, contentGetters, collabDebugger, quill, DEBUG_MESSAGE;
  var messageListeners = [],
    yMock = {
      val: function() {
        return {
          getText: function() {
            return 'abc';
          }
        };
      }
    },
    connectorMock = {
      whenSynced: function() {},
      addMessageListener: function(callback) {
        messageListeners.push(callback);
      },
      getMessageListeners: function() {
        return messageListeners;
      }
    }, easyRTCService = {},
    currentConferenceStateMock = {},
    modalMock;


  beforeEach(function() {
    angular.mock.module('collaborativeDebugger');
    angular.mock.module('jadeTemplates');
  });

  beforeEach(function() {
    angular.mock.module(function($provide) {
      var emptyFun = function() {
        return function() {};
      };
      $provide.service('yjsService', function () {
        return{
          y: yMock,
          connector: connectorMock
        };
      });
      $provide.value('saverFactory', {});
      $provide.value('i18nService', {
        __: function() {
          return {
            then: emptyFun()
          };
        }
      });

      $provide.value('easyRTCService', easyRTCService);
      $provide.value('editorFactory', {
        getEditor: function() {
          return quill;
        }
      });
      currentConferenceStateMock = {
        getAttendeeByEasyrtcid: function(id) {
          return id;
        }
      };
      $provide.value('currentConferenceState', currentConferenceStateMock);

      $provide.value('$modal', function() {
        modalMock.apply(modalMock, arguments);
      });

    });
  });

  beforeEach(function() {
    angular.mock.inject(function(_contentsToHtml_, _$window_, _$rootScope_, _contentGetters_, _collabDebugger_, _DEBUG_MESSAGE_) {
      contentsToHtml = _contentsToHtml_;
      $window = _$window_;
      contentGetters = _contentGetters_;
      collabDebugger = _collabDebugger_;
      $rootScope = _$rootScope_;
      DEBUG_MESSAGE = _DEBUG_MESSAGE_;
      quill = new $window.Quill(angular.element('<div></div>').get(0));
    });
  });

  describe('The services', function() {
    var content, expected;

    beforeEach(function() {
      content = { ops: [
        { insert: 'Foo ' },
        { insert: 'bar', attributes: {bold: true}},
        { insert: '\n'}
      ]};
      expected = '<div>Foo <b>bar</b></div>';
    });

    describe('contentsToHTML', function() {
      it.skip('should create a container for Quill when not present', function() {
        // How can I test it?
      });


      it('should use quill to convert into HTML', function() {
        var got = contentsToHtml(content);

        expect(got).to.equal(expected);
      });
    });

    describe('contentGetters', function() {

      describe('getQuillContents', function() {
        it('should call resolve when no error', function(done) {
          var resolve = function(html) {
              expect(html).to.equal(expected);
              done();
            },
            reject = function() {
              done('Reject should not have been called');
            },
            getHTML = chai.spy(function() {
              return expected;
            });

          quill.getHTML = getHTML;
          expect(contentGetters.quill).to.exist;
          contentGetters.quill().then(resolve, reject);

          $rootScope.$digest();
        });

        it('should call reject on error', function(done) {
          var resolve = function() {
                done('Resolve should not have been called');
              },
              reject = function(error) {
                expect(error).to.equal('An error ocurred while getting Quill content');
                done();
              };

          quill.getHTML = null;
          contentGetters.quill().then(resolve, reject);

          $rootScope.$digest();
        });
      });

      describe('getYjsContents', function() {
        it('should call resolve when no error', function(done) {
          var resolve = function(html) {
              expect(html).to.equal(expected);
              done();
            },
            reject = function() {
              done('Reject should not have been called');
            };

          yMock.val = function() {
            return {
              getDelta: function() {
                return content.ops ;
              }
            };
          };

          expect(contentGetters.yjs).to.exist;
          contentGetters.yjs().then(resolve, reject);

          $rootScope.$digest();
        });

        it('should call reject when the editor object does not exist', function(done) {
          var resolve = function() {
              done('Resolve should not have been called with', arguments);
            },
            reject = function(error) {
              expect(error).to.equal('Editor object does no exist');
              done();
            };
          yMock.val = function() {
            return undefined;
          };
          contentGetters.yjs().then(resolve, reject);

          $rootScope.$digest();
        });
      });

      describe('getRemote', function() {
        var peer = 'some peer id', source = 'yjs';
        beforeEach(function() {
          easyRTCService.setPeerListener = chai.spy();
          easyRTCService.sendData = chai.spy();
        });

        it('should return a function generating a promise', function() {

          expect(contentGetters.getRemote(peer, source)).to.be.a('function');
          expect(contentGetters.getRemote(peer, source)()).to.have.property('then');
        });

        it('should resolve on successful DEBUG_MESSAGE.reply ', function(done) {
          var resolve, reject;
          easyRTCService.setPeerListener = chai.spy(function(listener) {
            listener(null, null, {content: 'foo'});
          });
          resolve = function() {
            expect(easyRTCService.setPeerListener).to.have.been.called.once.with(DEBUG_MESSAGE.reply + source, peer);
            done();
          };
          reject = function() {
            done('Should not have been called');
          };
          var promise = contentGetters.getRemote(peer, source);
          promise().then(resolve, reject);

          $rootScope.$digest();
        });

        it('should reject on non-successful DEBUG_MESSAGE.reply ', function(done) {
          var reject, resolve;
          easyRTCService.setPeerListener = chai.spy(function(listener) {
            listener(null, null, {error: 'foo'});
          });
          reject = function() {
            expect(easyRTCService.setPeerListener).to.have.been.called.once.with(DEBUG_MESSAGE.reply + source, peer);
            done();
          };
          resolve = function() {
            done('Should not have been called');
          };
          var promise = contentGetters.getRemote(peer, source);
          promise().then(resolve, reject);

          $rootScope.$digest();
        });

        it('should communicate on DEBUG_MESSAGE.ask', function(done) {
          easyRTCService.setPeerListener = function(listener) {
            listener(null, null, JSON.stringify({content: 'foo'}));
          };
          var promise = contentGetters.getRemote(peer, source);
          var resolve = function() { done();};
          promise().then(resolve);

          expect(easyRTCService.sendData).to.have.been.called.with(peer, DEBUG_MESSAGE.ask, source);

          $rootScope.$digest();
        });
      });
    });

    describe('collabDebugger', function() {
      it('should expose a peers function', function() {
        connectorMock.connections = {
          'foo': {
            is_synced: true
          },
          'bar': {
            is_synced: false
          }
        };
        var peers = collabDebugger.peers();
        expect(peers).to.be.an('array');
        expect(peers.length).to.equal(2);
        expect(peers[0]).to.have.property('is_synced', true);
        expect(peers[0]).to.have.property('id', 'foo');

        expect(peers[1]).to.have.property('is_synced', false);
        expect(peers[1]).to.have.property('id', 'bar');
      });

      it('should expose a yjs attribute', function() {
        expect(collabDebugger.yjs).to.exist
          .and.to.be.an('object');
      });

      describe('fill function', function() {
        it('should exist', function() {
          expect(collabDebugger.fill).to.exist;
        });

        it('should fail if the first argument is not a promise', function() {
          var anArray = ['foo'], aFunction = function() {return 'foo';},
              fail;

          fail = function() {
            collabDebugger.fill(anArray, null, null);
          };
          expect(fail).to.throw(/expected first parameter to be a promise/);

          fail = function() {
            collabDebugger.fill(aFunction, null, null);
          };
          expect(fail).to.throw(/expected first parameter to be a promise/);
        });

        it('should fill the container correctly', function() {
          var promiseResolve, promiseReject,
            container = {},
            title = 'foo',
            strResolve = 'This is a test',
            strReject = 'This is another a test';

          promiseResolve = function () {
            return {
              then: function (resolve, reject) {
                resolve(strResolve);
              }
            };
          };
          promiseReject = function () {
            return {
              then: function (resolve, reject) {
                reject(strReject);
              }
            };
          };
          collabDebugger.fill(promiseResolve, title, container);
          expect(container).to.have.property('title', title);
          expect(container).to.have.property('content', strResolve);
          expect(container).to.have.property('class', 'success');

          collabDebugger.fill(promiseReject, title, container);
          expect(container).to.have.property('title', title);
          expect(container).to.have.property('content', strReject);
          expect(container).to.have.property('class', 'error');
        });
      });

      describe('peerName', function() {
        it('should be a function', function() {
          expect(collabDebugger.peerName).to.be.a('function');
        });

        it('should call getAttendeeByEasyrtcId function', function() {
          currentConferenceStateMock.getAttendeeByEasyrtcid = chai.spy(function() {
            return {
              displayName: 'foo'
            };
          });
          var someRtcId = 'qfsqs dfqsdf qsdf qsdf ';
          var ret = collabDebugger.peerName(someRtcId);

          expect(currentConferenceStateMock.getAttendeeByEasyrtcid).to.have.been.called.once
            .with(someRtcId);
          expect(ret).to.equal('foo');
        });
      });

    });

  });

  describe('The directive', function() {
    var scope, $rootScope, element, $modal, localScope, modalScope, collabDebug;
    describe('collabDebugLauncher', function() {

      beforeEach(angular.mock.inject(function(_$rootScope_, _$modal_, $compile, _collabDebugger_) {
        $rootScope = _$rootScope_;
        scope = $rootScope.$new();
        $modal = _$modal_;
        collabDebug = _collabDebugger_;

        element = angular.element('<collab-debug-launcher ng-click="onClick()"></collab-debug-launcher>');

        $compile(element)(scope);
        scope.$digest();

        localScope = element.scope();

      }));

      beforeEach(function() {
        modalMock = function(params) {
          expect(params.scope).to.exist;
          expect(params.template).to.exist;

          modalScope = params.scope;
        };

        collabDebug.yjs = {
          val: function() {
            return {
              'foo': null,
              'bar': null
            };
          }
        };
      });

      it('should create a modal on click with the good the scope', function() {
        modalMock = chai.spy();
        element.click();

        expect(modalMock).to.have.been.called.once;
      });

      it('should create a modal on click with the good the scope', function() {
        element.click();

        expect(modalScope.showCompare).to.be.false;
        expect(modalScope.sharedValues).to.be.an('object');
        expect(modalScope.peers).to.be.an('array');
        expect(modalScope.left).to.be.an('object');
        expect(modalScope.right).to.be.an('object');
        expect(modalScope.toggleCompareQuillYjs).to.be.a('function');
        expect(modalScope.toggleCompareOwnAndRemote).to.be.a('function');
      });

      describe('toggleCompareQuillYjs', function() {
        beforeEach(function() {
          element.click();
        });

        it('should toggle showCompare', function() {
          modalScope.toggleCompareQuillYjs();
          expect(modalScope.showCompare).to.be.true;

          modalScope.toggleCompareQuillYjs();
          expect(modalScope.showCompare).to.be.false;
        });

        it('should call collabDebug.fill', function() {
          collabDebug.fill = chai.spy();
          contentGetters.yjs = 'foo';
          contentGetters.quill = 'bar';

          modalScope.toggleCompareQuillYjs();

          expect(collabDebug.fill).to.have.been.called.with(contentGetters.yjs, 'Yjs', modalScope.left);
          expect(collabDebug.fill).to.have.been.called.with(contentGetters.quill, 'Quill', modalScope.right);
        });
      });

      describe('toggleCompareOwnAndRemote', function() {
        var peerId, source;
        beforeEach(function() {
          element.click();
          peerId = 'abcdefg';
          source = 'quill';
        });

        it('should toggle showCompare', function() {
          modalScope.toggleCompareOwnAndRemote(peerId, source);
          expect(modalScope.showCompare).to.be.true;

          modalScope.toggleCompareOwnAndRemote(peerId, source);
          expect(modalScope.showCompare).to.be.false;
        });

        it('should call collabDebug.fill', function() {
          collabDebug.fill = chai.spy();
          contentGetters.yjs = 'foo';
          contentGetters.getRemote = function() {
            return 'bar';
          };

          modalScope.toggleCompareQuillYjs(peerId, source);

          expect(collabDebug.fill).to.have.been.called.with(contentGetters.yjs, 'Yjs', modalScope.left);
        });

        it('should fail if peerId or source is missing, or unknown source', function() {
          var fail = function() {
            modalScope.toggleCompareOwnAndRemote();
          };
          expect(fail).to.throw(/missing first argument/);

          fail = function() {
            modalScope.toggleCompareOwnAndRemote(peerId);
          };
          expect(fail).to.throw(/missing second argument/);

          fail = function() {
            modalScope.toggleCompareOwnAndRemote(peerId, 'I am a random source');
          };
          expect(fail).to.throw(/unknown source/);
        });
      });
    });

    describe('compareLocalAndAllRemote', function() {
      var peerList;
      beforeEach(angular.mock.inject(function(_$rootScope_, _$modal_, $compile, _collabDebugger_) {
        $rootScope = _$rootScope_;
        scope = $rootScope.$new();
        $modal = _$modal_;
        collabDebugger = _collabDebugger_;

        peerList = [
          { id: 'foo' },
          { id: 'bar' }
        ];
        collabDebugger.peers = function() {
          return peerList;
        };

        element = angular.element('<div compare-local-and-all-remote do-compare-yjs="true" do-compare-quill="false"></div>');

        $compile(element)(scope);
        scope.$digest();

        localScope = element.isolateScope();
      }));

      it('should expose functions and attributes', function() {
        expect(localScope.compare).to.be.a('function');
        expect(localScope.showCompare).to.be.false;
        expect(localScope.compareName).to.equal('yjs');
        expect(localScope.doCompareYjs).to.be.true;
        expect(localScope.doCompareQuill).to.be.false;
      });

      describe('the compare function', function() {
        var fakePromise = function(contentToReturn) {
          return {
            then: function(resolve) {
              resolve(contentToReturn);
            }
          };
        };
        beforeEach(function() {

          contentGetters.yjs = chai.spy();
          contentGetters.quill = chai.spy(fakePromise('abcd'));
          contentGetters.yjs = chai.spy(fakePromise('abcd'));
          contentGetters.getRemote = chai.spy(function() {
            return function() {
              return fakePromise('abcd');
            };
          });
        });

        it('should get the local content', function() {
          contentGetters.quill = chai.spy(fakePromise('abcd'));
          contentGetters.yjs = chai.spy(fakePromise('abcd'));
          contentGetters.getRemote = chai.spy(function() {
            return function() {
              return fakePromise('abcd');
            };
          });
          localScope.doCompareYjs = localScope.doCompareQuill = true;

          localScope.compare();

          peerList.forEach(function(peer) {
            expect(contentGetters.getRemote).to.have.been.called.with(peer.id, 'yjs');
            expect(contentGetters.getRemote).to.have.been.called.with(peer.id, 'quill');
          });
          expect(contentGetters.yjs).to.have.been.called.exactly(peerList.length);

          expect(contentGetters.quill).to.have.been.called.exactly(peerList.length);
        });

      });
    });
  });
});
