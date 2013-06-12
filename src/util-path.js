/**
 * util-path.js - The utilities for operating path such as id, uri
 */

var DIRNAME_RE = /[^?#]*\//

var DOT_RE = /\/\.\//g
var MULTIPLE_SLASH_RE = /([^:\/])\/\/+/g
var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//

var normalizeCache = {}

// Extract the directory portion of a path
// dirname("a/b/c.js?t=123#xx/zz") ==> "a/b/"
// ref: http://jsperf.com/regex-vs-split/2
function dirname(path) {
  return path.match(DIRNAME_RE)[0]
}

// Canonicalize a path
// realpath("http://test.com/a//./b/../c") ==> "http://test.com/a/c"
function realpath(path) {
  // /a/b/./c/./d ==> /a/b/c/d
  if (path.indexOf('/./') > 0) {
    path = path.replace(DOT_RE, "/")
  }

  // "file:///a//b/c"  ==> "file:///a/b/c"
  // "http://a//b/c"   ==> "http://a/b/c"
  // "https://a//b/c"  ==> "https://a/b/c"
  // "/a/b//"          ==> "/a/b/"
  if (path.replace("://", "").indexOf("//") > 0) {
    path = path.replace(MULTIPLE_SLASH_RE, "$1\/")
  }

  // a/b/c/../../d  ==>  a/b/../d  ==>  a/d
  if (path.indexOf('/../') > 0) {
    while (path.match(DOUBLE_DOT_RE)) {
      path = path.replace(DOUBLE_DOT_RE, "/")
    }
  }

  return path
}

// Normalize an uri
// normalize("path/to/a") ==> "path/to/a.js"
function normalize(uri) {
  var key = uri

  if (normalizeCache[key]) {
    return normalizeCache[key]
  }

  // Call realpath() before adding extension, so that most of uris will
  // contains no `.` and will just return in realpath() call
  uri = realpath(uri)

  // Add the default `.js` extension except that the uri ends with `#`
  var last = uri.charAt(uri.length - 1)
  if (last === "#") {
    uri = uri.slice(0, -1)
  }
  // Exclude ? and directory path
  // NOTICE: This code below is faster than RegExp /\?|\.(?:css|js)$|\/$/
  else if (uri.indexOf("?") === -1 && last !== "/") {
    var pos = uri.lastIndexOf(".")
    var extname = pos > 0 ? uri.substring(pos + 1).toLowerCase() : ""

    if (extname !== "js" && extname !== "css") {
      uri += ".js"
    }
  }

  // Memoize normalize function
  return (normalizeCache[key] = uri)
}


var PATHS_RE = /^([^/:]+)(\/.+)$/
var VARS_RE = /{([^{]+)}/g

function parseAlias(id) {
  var alias = data.alias
  return alias && isString(alias[id]) ? alias[id] : id
}

function parsePaths(id) {
  var paths = data.paths
  var m

  if (paths && (m = id.match(PATHS_RE)) && isString(paths[m[1]])) {
    id = paths[m[1]] + m[2]
  }

  return id
}

function parseVars(id) {
  var vars = data.vars

  if (vars && id.indexOf("{") > -1) {
    id = id.replace(VARS_RE, function(m, key) {
      return isString(vars[key]) ? vars[key] : m
    })
  }

  return id
}

function parseMap(uri) {
  var map = data.map
  var ret = uri

  if (map) {
    for (var i = 0, len = map.length; i < len; i++) {
      var rule = map[i]

      ret = isFunction(rule) ?
          (rule(uri) || uri) :
          uri.replace(rule[0], rule[1])

      // Only apply the first matched rule
      if (ret !== uri) break
    }
  }

  return ret
}


function isAbsolute(id) {
  return id.indexOf(":/") > 0 || id.indexOf("//") === 0
}

function isRelative(id) {
  return id.charAt(0) === "."
}

function isRoot(id) {
  return id.charAt(0) === "/"
}


var ROOT_DIR_RE = /^.*?\/\/.*?\//

function addBase(id, refUri) {
  var ret

  if (isAbsolute(id)) {
    ret = id
  }
  else if (isRelative(id)) {
    ret = (refUri ? dirname(refUri) : data.cwd) + id
  }
  else if (isRoot(id)) {
    var m = data.cwd.match(ROOT_DIR_RE)
    ret = m ? m[0] + id.substring(1) : id
  }
  // top-level id
  else {
    ret = data.base + id
  }

  return ret
}

function id2Uri(id, refUri) {
  if (!id) return ""

  id = parseAlias(id)
  id = parsePaths(id)
  id = parseVars(id)

  var uri = addBase(id, refUri)
  uri = normalize(uri)
  uri = parseMap(uri)

  return uri
}


var doc = document
var loc = location
var cwd = dirname(loc.href)
var scripts = doc.getElementsByTagName("script")

// Recommend to add `seajsnode` id for the `sea.js` script element
var loaderScript = doc.getElementById("seajsnode") ||
    scripts[scripts.length - 1]

// When `sea.js` is inline, set loaderDir to current working directory
var loaderDir = dirname(getScriptAbsoluteSrc(loaderScript) || cwd)

function getScriptAbsoluteSrc(node) {
  return node.hasAttribute ? // non-IE6/7
      node.src :
    // see http://msdn.microsoft.com/en-us/library/ms536429(VS.85).aspx
      node.getAttribute("src", 4)
}

