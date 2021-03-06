define(["js/utils","js/api/all","js/flash_messages"],function (Utils,Apis,FlashMessagesService) {
    'use strict';

    var IssueManager = function(params){
        this.params = params;
    };

    IssueManager.prototype.hasLabel = function(issue,label){
        for (var i in issue.labels){
            var issueLabel = issue.labels[i];
            if (label.toLowerCase() == issueLabel.name.toLowerCase())
                return true;
        }
        return false;
    }

    IssueManager.prototype._setStateImmediately = function(issue,state){

        if (issue.state != state)
            issue.state = state;

    };

    IssueManager.prototype._setState = function(issue,state,onSuccess,onError){

        Apis.issue.updateIssue(this.params.repositoryId,issue.number,{state : state},onSuccess,onError);
    };

    var categoryLabels = ['doing','to-do','awaiting-review','done'];

    IssueManager.prototype._setLabelsImmediately = function(issue,labels){

        var labelsToRemove = issue.labels.filter(function(label){
                            return Object.keys(labels).indexOf(label.name) !== -1 && labels[label.name] == false;
                            })
                         .map(function(label){return label.name;});

        issue.labels = issue.labels.filter(function(label){
            return (labelsToRemove.indexOf(label.name) == -1) ? true: false
        });

        var issueLabelNames= issue.labels.map(function(label){return label.name});

        var labelsToAdd = Object.keys(labels).filter(function(label){
                            if (!labels[label])
                                return false;
                            if (issueLabelNames.indexOf(label) == -1)
                                return true;
                            return false;});

        for(var i in labelsToAdd){
            var labelToAdd = labelsToAdd[i];
            issue.labels.push(this.params.labelsByName[labelToAdd] || {name : labelToAdd});
        }

        return {remove : labelsToRemove,add : labelsToAdd};

    }

    IssueManager.prototype._setLabels = function(issue,labelsToRemove,labelsToAdd,onSuccess,onError){

        var removeCallback = onSuccess;

        if (labelsToRemove.length)
            for(var i in labelsToRemove){
                removeCallback = function(oldCallback){
                    Apis.label.removeLabel(this.params.repositoryId,issue.number,labelsToRemove[i],oldCallback,onError);
                }.bind(this,removeCallback);
            }
        if (labelsToAdd.length)
            Apis.label.addLabels(this.params.repositoryId,issue.number,labelsToAdd,removeCallback,onError);
        else if (removeCallback)
            removeCallback();

    }

    IssueManager.prototype.getMinutes = function(timeString){
        var re = /([\d]+)(m|h|d)/i;
        var res = re.exec(timeString);
        if (res){
            var number = parseInt(res[1]);
            switch(res[2]){
                case 'm':return number;
                case 'h':return number*60;
                case 'd':return number*60*8;
            }
        }
        return undefined;
    };

    IssueManager.prototype.formatMinutes = function(minutes){
        if (minutes < 60)
            return minutes+'m';
        else if (minutes < 8*60){
            var hours = Math.floor(minutes/60);
            var minutes = minutes % 60;
            var str = hours+'h';
            if (minutes)
                str+=' '+minutes+'m';
            return str;
        }
        var days = Math.floor(minutes/60/8);
        var hours = Math.floor((minutes%(60*8))/60);
        var minutes = minutes % 60;
        str = days+'d';
        if (hours)
            str+=' '+hours+'h';
        if (minutes)
            str+=' '+minutes+'m';
        return str;
    };

    IssueManager.prototype.getTime = function(issue,type){
        for (var i in issue.labels){
            var label = issue.labels[i];
            var re;
            if (type == 'estimate')
                re = /^time-estimate-([\d\w]+)$/i;
            else
                re = /^time-spent-([\d\w]+)$/i;
            var res = re.exec(label.name);
            if (res){
                return res[1];
            }
        }
        return null;
    };

    IssueManager.prototype.setTime = function(issue,time,type){
        var labels = {};
        for(var i in issue.labels){
            var label = issue.labels[i];
            if (type == 'estimate'){
                if (/^time-estimate-/i.exec(label.name))
                    labels[label.name] = false;
            }else{
                if (/^time-spent-/i.exec(label.name))
                    labels[label.name] = false;
            }
        }
        if (time){
            if (type == 'estimate')
                labels['time-estimate-'+time] = true;
            else
                labels['time-spent-'+time] = true;
        }

        var labelOps = this._setLabelsImmediately(issue,labels);

        if (this.params.onImmediateChange)
            this.params.onImmediateChange();

        this._setLabels(issue,labelOps.remove,labelOps.add,this.params.onResourceChange,this.params.onError);
    }

    IssueManager.prototype.assignTo = function(issue,collaborator){
        issue.assignee = collaborator;
        if (this.params.onImmediateChange)
            this.params.onImmediateChange();
        Apis.issue.updateIssue(this.params.repositoryId,
                                    issue.number,
                                    {assignee : collaborator ? collaborator.login : null},
                                    this.params.onResourceChange,
                                    this.params.onError);
    };

    IssueManager.prototype.setMilestone = function(issue,milestone){
        issue.milestone = milestone;
        if (this.params.onImmediateChange)
            this.params.onImmediateChange();
        Apis.issue.updateIssue(this.params.repositoryId,
                                    issue.number,
                                    {milestone : milestone ? milestone.number : null},
                                    this.params.onResourceChange,
                                    this.params.onError);
    };

    IssueManager.prototype.isMemberOf = function(issue,category){
        var closed = false;
        var labels = [];
        switch(category){
            case 'toDo':labels=['to-do'];break;
            case 'doing':labels=['doing'];break;
            case 'awaitingReview':labels=['awaiting-review'];break;
            case 'done':closed = true;break;
            default:return false;
        }
        if (labels.length){
            var found = false;
            for (var i in labels){
                var label = labels[i];
                if (this.hasLabel(issue,label))
                    found = true;
            }
            if (!found)
                return false;
        }
        if ((closed && issue.state == 'open') || ((!closed) && issue.state == 'closed'))
            return false;
        return true;
    },

    IssueManager.prototype.moveTo = function(issue,category){
        var closed = false;
        var labels = {
            'to-do' : false,
            'doing' : false,
            'awaiting-review' : false,
            'done' : false,
        }
        var labelsToAdd = [];
        var labelsToRemove = [];
        switch(category){
            case 'toDo' : labels['to-do'] = true;break;
            case 'doing' : labels['doing'] = true;break;
            case 'awaitingReview' : labels['awaiting-review'] = true;break;
            case 'done' : closed = true;break;
            default: break;
        };
        this._setStateImmediately(issue,closed ? 'closed' : 'open');
        if (this.params.onImmediateChange)
            this.params.onImmediateChange();
        var labelOps = this._setLabelsImmediately(issue,labels);
        this._setState(issue,closed ? 'closed' : 'open',
            function(){this._setLabels(issue,labelOps.remove,labelOps.add,this.params.onResourceChange,this.params.onError);}.bind(this),this.params.onError);
    },

    IssueManager.prototype.issueCategories = {
        toDo : {
            title : 'To Do',
            label : 'to-do',
        },
        doing : {
            title : 'Doing',
            label : 'doing',
        },
        awaitingReview : {
            title : 'Awaiting Review',
            label : 'awaiting-review',
        },
        done : {
            title : 'Done',
            label : null
        },
    };

    return IssueManager;

});