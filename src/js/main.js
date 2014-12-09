define(["js/components/app",
        "react",
        "js/utils",
        "director",
        ],function (MainApp,
                    React,
                    Utils,
                    Director
                    )
    {

    var app = undefined;
    var appComponent = undefined;

    function initApp(){
        appComponent = React.render(app,
          document.getElementById('app')
        );
    }

    function render(props){
        if (window.ga !== undefined){
            ga('send', 'pageview', {
             'page': location.pathname + location.search  + location.hash
            });
        }
        if (props.params !== undefined)
        {
            props.stringParams = props.params.slice(1);
            props.params = Utils.getUrlParameters(props.params.slice(1));
        }
        else
            props.params = {};

        if (app === undefined)
        {
            app = React.createElement(MainApp,props);
            initApp();
        }
        else
            appComponent.replaceProps(props);
    }

    var routes = {
        '' : 
            function(){return {screen : 'index',data : {}}},
        '/sprintboard/:repositoryId/:milestoneId': 
            function(repositoryId,milestoneId){return {screen : 'sprintboard',anonOk : true,
                data : {repositoryId : repositoryId,milestoneId : milestoneId}
            }},
        '/repositories': 
            function(){return {screen : 'repositories',
                data : {}
            }},
        '/repositories/:organizationId': 
            function(organizationId){return {screen : 'repositories',
                data : {organizationId : organizationId}
            }},
        '/organizations': 
            function(){return {screen : 'organizations',
                data : {}
            }},
        '/milestones/:repositoryId': 
            function(repositoryId){return {screen : 'milestones',anonOk : true,
                data : {repositoryId : repositoryId}
            }},
        '/login': 
            function(){return {screen : 'login',
                data : {}
            }},
        '/logout' : 
            function(){return {screen : 'logout',
                data : {}
            }},
      };

    var router = new Director();

    router.configure({notfound : function(url){Utils.redirectTo("#/");},strict : false });
    router.param('repositoryId', /([\w\d\-\:\.\/]+)/);
    router.param('milestoneId', /([\w\d\-\:\.]+)/);
    router.param('organizationId', /([\w\d\-\:\.]+)/);

    //We add URL-style parameters to all routes by decorating the original handler function.
    var routesWithParams = {};
    for (var url in routes){
        var urlWithParams = url+'/?(\\?.*)?';
        var generateCallBack = function(url, urlWithParams){
            return function(){
                var callBack = routes[url];
                var params = callBack.apply(
                    this,
                    Array.prototype.slice.call(arguments, 0, arguments.length-1)
                );
                params['params'] = arguments[arguments.length-1];
                params['url'] = url;
                return render(params);
            };
        };
        routesWithParams[urlWithParams] = generateCallBack(url,urlWithParams);
    }

    router.mount(routesWithParams);

    if (window.location.hash == '')
        window.location.hash="#/";

    router.init();

    return {'router' : router,'initApp' : initApp};
    });
