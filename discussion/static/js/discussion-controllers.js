(function(angular){
    'use strict';
    var app = angular.module('discussion.controllers', ['ngSanitize']);

    app.controller('ForumCtrl', ['$scope', '$routeParams', '$http', 'Forum', 'Topic',
        function ($scope, $routeParams, $http, Forum, Topic) {
            function normalInit() {
                $scope.forums = Forum.query({});
                $scope.latest_topics = Topic.query({
                    limit: 6,
                    ordering: '-last_activity_at',
                    }, function(){
                        $scope.topics_loaded = true;
                    }
                )
            }

            var forum_id = $routeParams.forumId;
            if(forum_id) {
                $scope.forum = Forum.get({id: forum_id},function(res){
                    $scope.forum_single = true;
                    $scope.forums = [];
                    res.latest_topics = Topic.query({
                        limit: 100,
                        forum: forum_id,
                        ordering: '-last_activity_at'}, function(topics){
                            $scope.topics_loaded = true;
                        }
                    );
                    $scope.forums.push(res); // to reuse template's ng-repeat
                },function(err){
                    normalInit();
                });
            } else {
                normalInit();
            }
            $scope.getResults = function(txt) {
                if(txt.length > 2) {
                    return $http.get('/discussion/api/typeahead/?search='+txt)
                    .then(function(results){
                        if(results.data.length > 0) {
                            var res = [];
                            results.data.unshift({
                                title:"Sugestões de tópicos",
                                disabled: true
                            });
                            return results.data;
                        }
                    });
                }
            }
        }
    ]);

    app.controller('NewTopicCtrl', ['$scope', '$window', '$location', 'Forum', 'Topic',
        function ($scope,  $window, $location, Forum, Topic) {
            $scope.forums = Forum.query();
            $scope.new_topic = new Topic();
            $scope.save_topic = function() {
                $scope.sending = true;
                // $scope.new_topic.forum = 1;
                $scope.new_topic.$save(function(topic){
                    var url = '/discussion/topic/#!/topic/'+topic.id;
                    $window.location.href = url;
                });
            }
        }
    ]);

    app.controller('TopicCtrl', ['$scope', '$routeParams', 'uiTinymceConfig', 'Forum', 'Topic', 'Comment', 'TopicLike', 'CommentLike', 'CommentFile',
        function ($scope, $routeParams, uiTinymceConfig, Forum, Topic, Comment, TopicLike, CommentLike, CommentFile) {

            $scope.topic = Topic.get({id: $routeParams.topicId});

            uiTinymceConfig.automatic_uploads = true;

            $scope.save_comment = function(topic, parent_comment) {
                var new_comment = new Comment();
                var new_comment_files = [];
                new_comment.topic = topic.id;
                if (parent_comment) {
                    new_comment.parent = parent_comment.id;
                    new_comment.text = parent_comment.new_comment;
                    new_comment_files = parent_comment.new_comment_files;
                    parent_comment.comment_replies.unshift(new_comment);
                } else {
                    new_comment.text = topic.new_comment;
                    topic.show_comment_input = false;
                    new_comment_files = topic.new_comment_files;
                    topic.comments.unshift(new_comment);
                }
                new_comment.$save().then(function(comment) {
                    angular.forEach(new_comment_files, function(comment_file) {
                        comment_file.comment = comment.id;
                        delete comment_file.file;
                        comment_file.$patch().then(function(comment_file_complete) {
                            comment.files.push(comment_file_complete)
                        });
                    })
                });
            }

            $scope.topic_like = function(topic) {
                if (topic.user_like) {
                    TopicLike.delete({id:topic.user_like});
                    topic.user_like = 0;
                    topic.count_likes -=1;
                } else {
                    // Change this before promisse so the user sees the action take effect.
                    topic.user_like = -1;

                    TopicLike.save({topic:topic.id}, function(topic_like){
                        topic.user_like = topic_like.id;
                    });
                    topic.count_likes +=1
                }
            };

            $scope.comment_like = function(comment) {
                if (comment.user_like) {
                    CommentLike.delete({id:comment.user_like});
                    comment.user_like = 0;
                    comment.count_likes -=1;
                } else {
                    // Change this before promisse so the user sees the action take effect.
                    comment.user_like = -1;

                    CommentLike.save({comment:comment.id}, function(comment_like){
                        comment.user_like = comment_like.id;
                    });
                    comment.count_likes +=1
                }
            };

            // uiTinymceConfig.file_browser_callback = function(field_name, url, type, win) {
            //     if(type=='image') {
            //         $('#select-file').click();
            //         console.log('file_browser_callback called!');
            //     }
            // };
            //
            // uiTinymceConfig.images_upload_handler = function (blobInfo, success, failure) {
            //     console.log('images_upload_handler called!');
            // };

            // ng-file-upload
            $scope.uploadCommentFiles = function (file, topic) {

                if (file) {
                    CommentFile.upload(file).then(function (response) {
                        var comment_file = new CommentFile(response.data);

                        if (topic.new_comment_files === undefined)
                            topic.new_comment_files = [];
                        topic.new_comment_files.push(comment_file);
                        return {location: comment_file.file};
                    }, function (response) {
                        if (response.status > 0) {
                            $scope.errorMsg = response.status + ': ' + response.data;
                        }
                    }, function (evt) {
                        // $scope.progress =
                        //     Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
                    });
                }
            }

        }
    ]);

})(window.angular);
