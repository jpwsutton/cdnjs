/**
@license
 * @pnp/odata v1.1.1 - pnp - provides shared odata functionality and base classes
 * MIT (https://github.com/pnp/pnpjs/blob/master/LICENSE)
 * Copyright (c) 2018 Microsoft
 * docs: https://pnp.github.io/pnpjs/
 * source: https:github.com/pnp/pnpjs
 * bugs: https://github.com/pnp/pnpjs/issues
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@pnp/common'), require('tslib'), require('@pnp/logging')) :
    typeof define === 'function' && define.amd ? define(['exports', '@pnp/common', 'tslib', '@pnp/logging'], factory) :
    (factory((global.pnp = global.pnp || {}, global.pnp.odata = {}),global.pnp.common,null,global.pnp.logging));
}(this, (function (exports,common,tslib_1,logging) { 'use strict';

    var CachingOptions = /** @class */ (function () {
        function CachingOptions(key) {
            this.key = key;
            this.expiration = common.dateAdd(new Date(), "second", common.RuntimeConfig.defaultCachingTimeoutSeconds);
            this.storeName = common.RuntimeConfig.defaultCachingStore;
        }
        Object.defineProperty(CachingOptions.prototype, "store", {
            get: function () {
                if (this.storeName === "local") {
                    return CachingOptions.storage.local;
                }
                else {
                    return CachingOptions.storage.session;
                }
            },
            enumerable: true,
            configurable: true
        });
        CachingOptions.storage = new common.PnPClientStorage();
        return CachingOptions;
    }());
    var CachingParserWrapper = /** @class */ (function () {
        function CachingParserWrapper(parser, cacheOptions) {
            this.parser = parser;
            this.cacheOptions = cacheOptions;
        }
        CachingParserWrapper.prototype.parse = function (response) {
            var _this = this;
            return this.parser.parse(response).then(function (r) { return _this.cacheData(r); });
        };
        CachingParserWrapper.prototype.cacheData = function (data) {
            if (this.cacheOptions.store !== null) {
                this.cacheOptions.store.put(this.cacheOptions.key, data, this.cacheOptions.expiration);
            }
            return data;
        };
        return CachingParserWrapper;
    }());

    /**
     * Represents an exception with an HttpClient request
     *
     */
    var ProcessHttpClientResponseException = /** @class */ (function (_super) {
        tslib_1.__extends(ProcessHttpClientResponseException, _super);
        function ProcessHttpClientResponseException(status, statusText, data) {
            var _this = _super.call(this, "Error making HttpClient request in queryable: [" + status + "] " + statusText) || this;
            _this.status = status;
            _this.statusText = statusText;
            _this.data = data;
            _this.name = "ProcessHttpClientResponseException";
            logging.Logger.log({ data: _this.data, level: 3 /* Error */, message: _this.message });
            return _this;
        }
        return ProcessHttpClientResponseException;
    }(Error));
    var ODataParserBase = /** @class */ (function () {
        function ODataParserBase() {
        }
        ODataParserBase.prototype.parse = function (r) {
            var _this = this;
            return new Promise(function (resolve, reject) {
                if (_this.handleError(r, reject)) {
                    _this.parseImpl(r, resolve, reject);
                }
            });
        };
        ODataParserBase.prototype.parseImpl = function (r, resolve, reject) {
            var _this = this;
            if ((r.headers.has("Content-Length") && parseFloat(r.headers.get("Content-Length")) === 0) || r.status === 204) {
                resolve({});
            }
            else {
                // patch to handle cases of 200 response with no or whitespace only bodies (#487 & #545)
                r.text()
                    .then(function (txt) { return txt.replace(/\s/ig, "").length > 0 ? JSON.parse(txt) : {}; })
                    .then(function (json) { return resolve(_this.parseODataJSON(json)); })
                    .catch(function (e) { return reject(e); });
            }
        };
        /**
         * Handles a response with ok === false by parsing the body and creating a ProcessHttpClientResponseException
         * which is passed to the reject delegate. This method returns true if there is no error, otherwise false
         *
         * @param r Current response object
         * @param reject reject delegate for the surrounding promise
         */
        ODataParserBase.prototype.handleError = function (r, reject) {
            if (!r.ok) {
                // read the response as text, it may not be valid json
                r.json().then(function (json) {
                    // include the headers as they contain diagnostic information
                    var data = {
                        responseBody: json,
                        responseHeaders: r.headers,
                    };
                    reject(new ProcessHttpClientResponseException(r.status, r.statusText, data));
                }).catch(function (e) {
                    // we failed to read the body - possibly it is empty. Let's report the original status that caused
                    // the request to fail and log the error without parsing the body if anyone needs it for debugging
                    logging.Logger.log({
                        data: e,
                        level: 2 /* Warning */,
                        message: "There was an error parsing the error response body. See data for details.",
                    });
                    // include the headers as they contain diagnostic information
                    var data = {
                        responseBody: "[[body not available]]",
                        responseHeaders: r.headers,
                    };
                    reject(new ProcessHttpClientResponseException(r.status, r.statusText, data));
                });
            }
            return r.ok;
        };
        /**
         * Normalizes the json response by removing the various nested levels
         *
         * @param json json object to parse
         */
        ODataParserBase.prototype.parseODataJSON = function (json) {
            var result = json;
            if (json.hasOwnProperty("d")) {
                if (json.d.hasOwnProperty("results")) {
                    result = json.d.results;
                }
                else {
                    result = json.d;
                }
            }
            else if (json.hasOwnProperty("value")) {
                result = json.value;
            }
            return result;
        };
        return ODataParserBase;
    }());
    var ODataDefaultParser = /** @class */ (function (_super) {
        tslib_1.__extends(ODataDefaultParser, _super);
        function ODataDefaultParser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return ODataDefaultParser;
    }(ODataParserBase));
    var TextParser = /** @class */ (function (_super) {
        tslib_1.__extends(TextParser, _super);
        function TextParser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        TextParser.prototype.parseImpl = function (r, resolve) {
            r.text().then(resolve);
        };
        return TextParser;
    }(ODataParserBase));
    var BlobParser = /** @class */ (function (_super) {
        tslib_1.__extends(BlobParser, _super);
        function BlobParser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        BlobParser.prototype.parseImpl = function (r, resolve) {
            r.blob().then(resolve);
        };
        return BlobParser;
    }(ODataParserBase));
    var JSONParser = /** @class */ (function (_super) {
        tslib_1.__extends(JSONParser, _super);
        function JSONParser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        JSONParser.prototype.parseImpl = function (r, resolve) {
            r.json().then(resolve);
        };
        return JSONParser;
    }(ODataParserBase));
    var BufferParser = /** @class */ (function (_super) {
        tslib_1.__extends(BufferParser, _super);
        function BufferParser() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        BufferParser.prototype.parseImpl = function (r, resolve) {
            if (common.isFunc(r.arrayBuffer)) {
                r.arrayBuffer().then(resolve);
            }
            else {
                r.buffer().then(resolve);
            }
        };
        return BufferParser;
    }(ODataParserBase));
    var LambdaParser = /** @class */ (function () {
        function LambdaParser(parser) {
            this.parser = parser;
        }
        LambdaParser.prototype.parse = function (r) {
            return this.parser(r);
        };
        return LambdaParser;
    }());

    /**
     * Resolves the context's result value
     *
     * @param context The current context
     */
    function returnResult(context) {
        logging.Logger.log({
            data: logging.Logger.activeLogLevel === 0 /* Verbose */ ? context.result : {},
            level: 1 /* Info */,
            message: "[" + context.requestId + "] (" + (new Date()).getTime() + ") Returning result from pipeline. Set logging to verbose to see data.",
        });
        return Promise.resolve(context.result || null);
    }
    /**
     * Sets the result on the context
     */
    function setResult(context, value) {
        return new Promise(function (resolve) {
            context.result = value;
            context.hasResult = true;
            resolve(context);
        });
    }
    /**
     * Invokes the next method in the provided context's pipeline
     *
     * @param c The current request context
     */
    function next(c) {
        if (c.pipeline.length > 0) {
            return c.pipeline.shift()(c);
        }
        else {
            return Promise.resolve(c);
        }
    }
    /**
     * Executes the current request context's pipeline
     *
     * @param context Current context
     */
    function pipe(context) {
        if (context.pipeline.length < 1) {
            logging.Logger.write("[" + context.requestId + "] (" + (new Date()).getTime() + ") Request pipeline contains no methods!", 2 /* Warning */);
        }
        var promise = next(context).then(function (ctx) { return returnResult(ctx); }).catch(function (e) {
            logging.Logger.error(e);
            throw e;
        });
        if (context.isBatched) {
            // this will block the batch's execute method from returning until the child requets have been resolved
            context.batch.addResolveBatchDependency(promise);
        }
        return promise;
    }
    /**
     * decorator factory applied to methods in the pipeline to control behavior
     */
    function requestPipelineMethod(alwaysRun) {
        if (alwaysRun === void 0) { alwaysRun = false; }
        return function (target, propertyKey, descriptor) {
            var method = descriptor.value;
            descriptor.value = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                // if we have a result already in the pipeline, pass it along and don't call the tagged method
                if (!alwaysRun && args.length > 0 && args[0].hasOwnProperty("hasResult") && args[0].hasResult) {
                    logging.Logger.write("[" + args[0].requestId + "] (" + (new Date()).getTime() + ") Skipping request pipeline method " + propertyKey + ", existing result in pipeline.", 0 /* Verbose */);
                    return Promise.resolve(args[0]);
                }
                // apply the tagged method
                logging.Logger.write("[" + args[0].requestId + "] (" + (new Date()).getTime() + ") Calling request pipeline method " + propertyKey + ".", 0 /* Verbose */);
                // then chain the next method in the context's pipeline - allows for dynamic pipeline
                return method.apply(target, args).then(function (ctx) { return next(ctx); });
            };
        };
    }
    /**
     * Contains the methods used within the request pipeline
     */
    var PipelineMethods = /** @class */ (function () {
        function PipelineMethods() {
        }
        /**
         * Logs the start of the request
         */
        PipelineMethods.logStart = function (context) {
            return new Promise(function (resolve) {
                logging.Logger.log({
                    data: logging.Logger.activeLogLevel === 1 /* Info */ ? {} : context,
                    level: 1 /* Info */,
                    message: "[" + context.requestId + "] (" + (new Date()).getTime() + ") Beginning " + context.verb + " request (" + context.requestAbsoluteUrl + ")",
                });
                resolve(context);
            });
        };
        /**
         * Handles caching of the request
         */
        PipelineMethods.caching = function (context) {
            return new Promise(function (resolve) {
                // handle caching, if applicable
                if (context.isCached) {
                    logging.Logger.write("[" + context.requestId + "] (" + (new Date()).getTime() + ") Caching is enabled for request, checking cache...", 1 /* Info */);
                    var cacheOptions = new CachingOptions(context.requestAbsoluteUrl.toLowerCase());
                    if (typeof context.cachingOptions !== "undefined") {
                        cacheOptions = common.extend(cacheOptions, context.cachingOptions);
                    }
                    // we may not have a valid store
                    if (cacheOptions.store !== null) {
                        // check if we have the data in cache and if so resolve the promise and return
                        var data = cacheOptions.store.get(cacheOptions.key);
                        if (data !== null) {
                            // ensure we clear any held batch dependency we are resolving from the cache
                            logging.Logger.log({
                                data: logging.Logger.activeLogLevel === 1 /* Info */ ? {} : data,
                                level: 1 /* Info */,
                                message: "[" + context.requestId + "] (" + (new Date()).getTime() + ") Value returned from cache.",
                            });
                            if (common.isFunc(context.batchDependency)) {
                                context.batchDependency();
                            }
                            // handle the case where a parser needs to take special actions with a cached result
                            if (context.parser.hasOwnProperty("hydrate")) {
                                data = context.parser.hydrate(data);
                            }
                            return setResult(context, data).then(function (ctx) { return resolve(ctx); });
                        }
                    }
                    logging.Logger.write("[" + context.requestId + "] (" + (new Date()).getTime() + ") Value not found in cache.", 1 /* Info */);
                    // if we don't then wrap the supplied parser in the caching parser wrapper
                    // and send things on their way
                    context.parser = new CachingParserWrapper(context.parser, cacheOptions);
                }
                return resolve(context);
            });
        };
        /**
         * Sends the request
         */
        PipelineMethods.send = function (context) {
            return new Promise(function (resolve, reject) {
                // send or batch the request
                if (context.isBatched) {
                    // we are in a batch, so add to batch, remove dependency, and resolve with the batch's promise
                    var p = context.batch.add(context.requestAbsoluteUrl, context.verb, context.options, context.parser, context.requestId);
                    // we release the dependency here to ensure the batch does not execute until the request is added to the batch
                    if (common.isFunc(context.batchDependency)) {
                        context.batchDependency();
                    }
                    logging.Logger.write("[" + context.requestId + "] (" + (new Date()).getTime() + ") Batching request in batch " + context.batch.batchId + ".", 1 /* Info */);
                    // we set the result as the promise which will be resolved by the batch's execution
                    resolve(setResult(context, p));
                }
                else {
                    logging.Logger.write("[" + context.requestId + "] (" + (new Date()).getTime() + ") Sending request.", 1 /* Info */);
                    // we are not part of a batch, so proceed as normal
                    var client = context.clientFactory();
                    var opts = common.extend(context.options || {}, { method: context.verb });
                    client.fetch(context.requestAbsoluteUrl, opts)
                        .then(function (response) { return context.parser.parse(response); })
                        .then(function (result) { return setResult(context, result); })
                        .then(function (ctx) { return resolve(ctx); })
                        .catch(function (e) { return reject(e); });
                }
            });
        };
        /**
         * Logs the end of the request
         */
        PipelineMethods.logEnd = function (context) {
            return new Promise(function (resolve) {
                if (context.isBatched) {
                    logging.Logger.log({
                        data: logging.Logger.activeLogLevel === 1 /* Info */ ? {} : context,
                        level: 1 /* Info */,
                        message: "[" + context.requestId + "] (" + (new Date()).getTime() + ") " + context.verb + " request will complete in batch " + context.batch.batchId + ".",
                    });
                }
                else {
                    logging.Logger.log({
                        data: logging.Logger.activeLogLevel === 1 /* Info */ ? {} : context,
                        level: 1 /* Info */,
                        message: "[" + context.requestId + "] (" + (new Date()).getTime() + ") Completing " + context.verb + " request.",
                    });
                }
                resolve(context);
            });
        };
        tslib_1.__decorate([
            requestPipelineMethod(true)
        ], PipelineMethods, "logStart", null);
        tslib_1.__decorate([
            requestPipelineMethod()
        ], PipelineMethods, "caching", null);
        tslib_1.__decorate([
            requestPipelineMethod()
        ], PipelineMethods, "send", null);
        tslib_1.__decorate([
            requestPipelineMethod(true)
        ], PipelineMethods, "logEnd", null);
        return PipelineMethods;
    }());
    function getDefaultPipeline() {
        return [
            PipelineMethods.logStart,
            PipelineMethods.caching,
            PipelineMethods.send,
            PipelineMethods.logEnd,
        ].slice(0);
    }

    var AlreadyInBatchException = /** @class */ (function (_super) {
        tslib_1.__extends(AlreadyInBatchException, _super);
        function AlreadyInBatchException(msg) {
            if (msg === void 0) { msg = "This query is already part of a batch."; }
            var _this = _super.call(this, msg) || this;
            _this.name = "AlreadyInBatchException";
            logging.Logger.error(_this);
            return _this;
        }
        return AlreadyInBatchException;
    }(Error));
    var Queryable = /** @class */ (function () {
        function Queryable() {
            this._query = new common.Dictionary();
            this._options = {};
            this._url = "";
            this._parentUrl = "";
            this._useCaching = false;
            this._cachingOptions = null;
        }
        /**
        * Gets the currentl url
        *
        */
        Queryable.prototype.toUrl = function () {
            return this._url;
        };
        /**
         * Directly concatonates the supplied string to the current url, not normalizing "/" chars
         *
         * @param pathPart The string to concatonate to the url
         */
        Queryable.prototype.concat = function (pathPart) {
            this._url += pathPart;
            return this;
        };
        Object.defineProperty(Queryable.prototype, "query", {
            /**
             * Provides access to the query builder for this url
             *
             */
            get: function () {
                return this._query;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Sets custom options for current object and all derived objects accessible via chaining
         *
         * @param options custom options
         */
        Queryable.prototype.configure = function (options) {
            common.mergeOptions(this._options, options);
            return this;
        };
        /**
         * Configures this instance from the configure options of the supplied instance
         *
         * @param o Instance from which options should be taken
         */
        Queryable.prototype.configureFrom = function (o) {
            common.mergeOptions(this._options, o._options);
            return this;
        };
        /**
         * Enables caching for this request
         *
         * @param options Defines the options used when caching this request
         */
        Queryable.prototype.usingCaching = function (options) {
            if (!common.RuntimeConfig.globalCacheDisable) {
                this._useCaching = true;
                if (typeof options !== "undefined") {
                    this._cachingOptions = options;
                }
            }
            return this;
        };
        Queryable.prototype.getCore = function (parser, options) {
            if (parser === void 0) { parser = new JSONParser(); }
            if (options === void 0) { options = {}; }
            return this.toRequestContext("GET", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        Queryable.prototype.postCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new JSONParser(); }
            return this.toRequestContext("POST", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        Queryable.prototype.patchCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new JSONParser(); }
            return this.toRequestContext("PATCH", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        Queryable.prototype.deleteCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new JSONParser(); }
            return this.toRequestContext("DELETE", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        Queryable.prototype.putCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new JSONParser(); }
            return this.toRequestContext("PUT", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        /**
         * Appends the given string and normalizes "/" chars
         *
         * @param pathPart The string to append
         */
        Queryable.prototype.append = function (pathPart) {
            this._url = common.combinePaths(this._url, pathPart);
        };
        Object.defineProperty(Queryable.prototype, "parentUrl", {
            /**
             * Gets the parent url used when creating this instance
             *
             */
            get: function () {
                return this._parentUrl;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * Extends this queryable from the provided parent
         *
         * @param parent Parent queryable from which we will derive a base url
         * @param path Additional path
         */
        Queryable.prototype.extend = function (parent, path) {
            this._parentUrl = parent._url;
            this._url = common.combinePaths(this._parentUrl, path);
            this.configureFrom(parent);
        };
        return Queryable;
    }());
    var ODataQueryable = /** @class */ (function (_super) {
        tslib_1.__extends(ODataQueryable, _super);
        function ODataQueryable() {
            var _this = _super.call(this) || this;
            _this._batch = null;
            return _this;
        }
        /**
         * Adds this query to the supplied batch
         *
         * @example
         * ```
         *
         * let b = pnp.sp.createBatch();
         * pnp.sp.web.inBatch(b).get().then(...);
         * b.execute().then(...)
         * ```
         */
        ODataQueryable.prototype.inBatch = function (batch) {
            if (this.batch !== null) {
                throw new AlreadyInBatchException();
            }
            this._batch = batch;
            return this;
        };
        /**
         * Gets the currentl url
         *
         */
        ODataQueryable.prototype.toUrl = function () {
            return this._url;
        };
        /**
         * Executes the currently built request
         *
         * @param parser Allows you to specify a parser to handle the result
         * @param getOptions The options used for this request
         */
        ODataQueryable.prototype.get = function (parser, options) {
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            if (options === void 0) { options = {}; }
            return this.getCore(parser, options);
        };
        ODataQueryable.prototype.getCore = function (parser, options) {
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            if (options === void 0) { options = {}; }
            return this.toRequestContext("GET", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        ODataQueryable.prototype.postCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            return this.toRequestContext("POST", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        ODataQueryable.prototype.patchCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            return this.toRequestContext("PATCH", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        ODataQueryable.prototype.deleteCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            return this.toRequestContext("DELETE", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        ODataQueryable.prototype.putCore = function (options, parser) {
            if (options === void 0) { options = {}; }
            if (parser === void 0) { parser = new ODataDefaultParser(); }
            return this.toRequestContext("PUT", options, parser, getDefaultPipeline()).then(function (context) { return pipe(context); });
        };
        /**
         * Blocks a batch call from occuring, MUST be cleared by calling the returned function
        */
        ODataQueryable.prototype.addBatchDependency = function () {
            if (this._batch !== null) {
                return this._batch.addDependency();
            }
            return function () { return null; };
        };
        Object.defineProperty(ODataQueryable.prototype, "hasBatch", {
            /**
             * Indicates if the current query has a batch associated
             *
             */
            get: function () {
                return common.objectDefinedNotNull(this._batch);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ODataQueryable.prototype, "batch", {
            /**
             * The batch currently associated with this query or null
             *
             */
            get: function () {
                return this.hasBatch ? this._batch : null;
            },
            enumerable: true,
            configurable: true
        });
        return ODataQueryable;
    }(Queryable));

    var ODataBatch = /** @class */ (function () {
        function ODataBatch(_batchId) {
            if (_batchId === void 0) { _batchId = common.getGUID(); }
            this._batchId = _batchId;
            this._requests = [];
            this._dependencies = [];
            this._resolveBatchDependencies = [];
        }
        Object.defineProperty(ODataBatch.prototype, "batchId", {
            get: function () {
                return this._batchId;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ODataBatch.prototype, "requests", {
            /**
             * The requests contained in this batch
             */
            get: function () {
                return this._requests;
            },
            enumerable: true,
            configurable: true
        });
        /**
         *
         * @param url Request url
         * @param method Request method (GET, POST, etc)
         * @param options Any request options
         * @param parser The parser used to handle the eventual return from the query
         */
        ODataBatch.prototype.add = function (url, method, options, parser, requestId) {
            var info = {
                id: requestId,
                method: method.toUpperCase(),
                options: options,
                parser: parser,
                reject: null,
                resolve: null,
                url: url,
            };
            var p = new Promise(function (resolve, reject) {
                info.resolve = resolve;
                info.reject = reject;
            });
            this._requests.push(info);
            return p;
        };
        /**
         * Adds a dependency insuring that some set of actions will occur before a batch is processed.
         * MUST be cleared using the returned resolve delegate to allow batches to run
         */
        ODataBatch.prototype.addDependency = function () {
            var resolver = function () { return void (0); };
            var promise = new Promise(function (resolve) {
                resolver = resolve;
            });
            this._dependencies.push(promise);
            return resolver;
        };
        /**
         * The batch's execute method will not resolve util any promises added here resolve
         *
         * @param p The dependent promise
         */
        ODataBatch.prototype.addResolveBatchDependency = function (p) {
            this._resolveBatchDependencies.push(p);
        };
        /**
         * Execute the current batch and resolve the associated promises
         *
         * @returns A promise which will be resolved once all of the batch's child promises have resolved
         */
        ODataBatch.prototype.execute = function () {
            var _this = this;
            // we need to check the dependencies twice due to how different engines handle things.
            // We can get a second set of promises added during the first set resolving
            return Promise.all(this._dependencies)
                .then(function () { return Promise.all(_this._dependencies); })
                .then(function () { return _this.executeImpl(); })
                .then(function () { return Promise.all(_this._resolveBatchDependencies); })
                .then(function () { return void (0); });
        };
        return ODataBatch;
    }());

    exports.CachingOptions = CachingOptions;
    exports.CachingParserWrapper = CachingParserWrapper;
    exports.ProcessHttpClientResponseException = ProcessHttpClientResponseException;
    exports.ODataParserBase = ODataParserBase;
    exports.ODataDefaultParser = ODataDefaultParser;
    exports.TextParser = TextParser;
    exports.BlobParser = BlobParser;
    exports.JSONParser = JSONParser;
    exports.BufferParser = BufferParser;
    exports.LambdaParser = LambdaParser;
    exports.setResult = setResult;
    exports.pipe = pipe;
    exports.requestPipelineMethod = requestPipelineMethod;
    exports.PipelineMethods = PipelineMethods;
    exports.getDefaultPipeline = getDefaultPipeline;
    exports.AlreadyInBatchException = AlreadyInBatchException;
    exports.Queryable = Queryable;
    exports.ODataQueryable = ODataQueryable;
    exports.ODataBatch = ODataBatch;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=odata.es5.umd.js.map
