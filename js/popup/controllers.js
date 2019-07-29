/*global angular, _eventPage, _i18n, _storage, */

/*
 * This file is part of Super Simple Highlighter.
 * 
 * Super Simple Highlighter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * Super Simple Highlighter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Controllers module
 * @type {ng.IModule}
 */
var popupControllers = angular.module('popupControllers', []);


// array this is something to do with minification
popupControllers.controller('DocumentsController', ["$scope", function ($scope) {
    'use strict';
    var backgroundPage;
    var activeTab;

    // models
    $scope.manifest = chrome.runtime.getManifest();

//    $scope.docs = [];
//    $scope.match = "hello";

	// starter
	chrome.tabs.query({ active: true, currentWindow: true }, function (result) {
	    chrome.runtime.getBackgroundPage(function (bgPage) {
	        // onInit(result[0], backgroundPage);
	        activeTab = result[0];
	        backgroundPage = bgPage;

			// initialize controller variables
	        _storage.getPopupHighlightTextMaxLength(function (max) {
	            if (max) {
	                $scope.popupHighlightTextMaxLength = max;
	            }
	        });
			
			// if the url protocol is file based, and the user hasn't been warned to enable
			// file access for the extension, set a flag now. The view will set the warning's
			// visibility based on its value.
			_storage.getFileAccessRequiredWarningDismissed(function(dismissed) {
				// if its already been dismissed before, no need to check
				if (!dismissed) {
					// it not being a file protocol url is the same as invisible (dismissed)
					var u = purl(activeTab.url);
					dismissed = ('file' !== u.attr('protocol'));
				}
				
				$scope.fileAccessRequiredWarningVisible = !dismissed;
			});
			
			// listener for variable change. syncs value to storage
            $scope.$watch('fileAccessRequiredWarningVisible', function (newVal, oldVal) {
                if (newVal !== oldVal) {
                    console.log(newVal);
                    _storage.setFileAccessRequiredWarningDismissed(!newVal);
                }
            });			
			
			// $scope.$apply();
			
	        // default to no clamp
	//        chrome.storage.sync.get({
	//            "highlightTextLineClamp": null
	//        }, function (result) {
	//            if (result) {
	//                $scope.webkitLineClamp = (result.highlightTextLineClamp ?
	//                    result.highlightTextLineClamp.toString() : null);
	//            }
	//        });

	        $scope.title = activeTab.title;
	        $scope.match = backgroundPage._database.buildMatchString(activeTab.url);

	        updateDocs();
	    });
	});

	/**
	 * Show the remaining hidden text for a specific highlight
	 * @param {Object} doc document for the specific highlight
	 */
    $scope.onClickMore = function (doc) {
        // TODO: shouldn't really be in the controller...
        $("#" + doc._id + " .highlight-text").text(doc.text);
    };

    /**
     * Click a highlight. Scroll to it in DOM
     * @param {object} doc
     */
    $scope.onClickHighlight = function (doc) {
        if (doc.isInDOM) {
            backgroundPage._eventPage.scrollTo(activeTab.id, doc._id);
        }
    };

    /**
     * Clicked 'select' button
     * @param {object} doc
     */
    $scope.onClickSelect = function (doc) {
        if (doc.isInDOM) {
            backgroundPage._eventPage.selectHighlightText(activeTab.id, doc._id);
            window.close();
        }
    };

    /**
     * Clicked 'copy' button for a highlight
     * @param documentId
     */
    $scope.onClickCopy = function (documentId) {
        backgroundPage._eventPage.copyHighlightText(documentId);
        window.close();
    };

    /**
     * Clicked 'speak' button for a highlight
     * @param documentId
     */
    $scope.onClickSpeak = function (documentId) {
        backgroundPage._eventPage.speakHighlightText(documentId);
    };

    /**
     * Clicked menu 'open overview' button. Opens a new tab, with the highlights fully displayed in it
     */
    $scope.onClickOpenOverviewInNewTab = function () {
        // get the full uri for the tab. the summary page will get the match for it
        chrome.tabs.create({
            url: "overview.html?" +
                "id=" + activeTab.id + "&" +
                "url=" + encodeURIComponent(activeTab.url) + "&" +
                "title=" + encodeURIComponent($scope.title)
        });
    };

    /**
     * Clicked 'remove' button for a highlight
     * @param {string} documentId highlight id
     */
    $scope.onClickRemoveHighlight = function (documentId) {
        backgroundPage._eventPage.deleteHighlight(activeTab.id,  documentId, function (err, result) {
            if (result && result.ok ) {
                updateDocs(function (err, docs) {
                    // close popup on last doc removed
                    if (docs && docs.length === 0) {
                        window.close();
                    }
                });
            }
        });
    };

    /**
     * Clicked 'remove all' button
     */
    $scope.onClickRemoveAllHighlights = function () {
        // if (window.confirm(chrome.i18n.getMessage("confirm_remove_all_highlights"))) {
            backgroundPage._eventPage.deleteHighlights(activeTab.id, $scope.match);
            window.close();
        // }
    };
	
	/**
	 * Clicked 'ok got it' button for the offline (file protocol) warning
	 */	
	$scope.onClickDismissFileAccessRequiredWarning = function () {
		// a listener created in the initializer will set the value to the storage
		$scope.fileAccessRequiredWarningVisible = false;
	};

    /**
     * Clear and fill the 'docs' model
     * @param {function} [callback] function(err, docs)
     * @private
     */
    var updateDocs = function (callback) {
        // get all the documents (create & delete) associated with the match, then filter the deleted ones
        backgroundPage._database.getCreateDocuments($scope.match, function (err, docs) {
            if (!err) {
                $scope.docs = docs;
                $scope.$apply();

                // if the highlight cant be found in DOM, flag that
                docs.forEach(function (doc) {
                    // default to undefined, implying it IS in the DOM
                    backgroundPage._eventPage.isHighlightInDOM(activeTab.id, doc._id, function (isInDOM) {
                        //                    if (!isInDOM) {
                        //                        console.log("Not in DOM");
                        //                    }

                        doc.isInDOM = isInDOM;
                        $scope.$apply();
                    });
                });
            }

            if (callback) {
                callback(err, docs);
            }
        });
    };
}]);