import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as builder from 'xmlbuilder';
import { Logger } from './logger';
import { of } from './optional';

interface XmlElement {
  name: string,
  attr: { [key: string]: string },
  children: XmlElement[],
  text?: string
}
const createXmlElement = (name: string, attr?: { [key: string]: string }, children?: XmlElement[], text?: string) => {

  if (name === TEXT_NODE_NAME && !text) {
    throw new Error('Empty text node is not allowed');
  }
  return {
    name,
    attr: attr ? attr : {},
    children: children ? children : [],
    text
  };
};

interface ParameterMapParameter {
  property: string;
  mode: string;
  jdbcType: string;
  javaType: string;
}
const createParameterMapParameter = (property: string, mode: string, jdbcType: string, javaType: string) => {

  if (mode.toUpperCase() !== 'IN' && mode.toUpperCase() !== 'OUT') {
    mode = 'IN';
  }
  return { property, mode, jdbcType, javaType };
};

/**
 * `parameterMap` is properties defination in a procedure call.
 *
 * A parameterMap just like:
 * ```
 * <parameterMap id="theId" class="map" >
 *   <parameter property="NAME" mode="IN" jdbcType="VARCHAR" javaType="java.lang.String"/>
 *   <parameter property="EMAIL" mode="IN" jdbcType="VARCHAR" javaType="java.lang.String"/>
 *   <parameter property="resultFlag" mode="OUT"  jdbcType="VARCHAR" javaType="java.lang.String"/>
 *   <parameter property="resultMsg" mode="OUT" jdbcType="VARCHAR" javaType="java.lang.String"/>
 * </parameterMap>
 * ```
 */
interface ParameterMap {
  id: string;
  class: string;
  parameters: ParameterMapParameter[];
}

const TEXT_NODE_NAME = '__text__';

export const LINE_SEPARATOR = '\n';

/**
 * Iterate every key of an object, returns a new object.
 *
 * @param obj Any object
 * @param keyMapper Key mapper, calls every key of `obj`
 * @returns New object after iteration finished
 */
const mapObject = (obj: any, keyMapper: ((newObj: any, key: string, value: string) => void)) => {
  const newObj = {};
  if (obj) {
    for (const key in obj) {
      if (!key) { continue; }
      const value = obj[key];
      keyMapper(newObj, key, value);
    }
  }
  return newObj;
};

/**
 * Based on xml2js (https://github.com/Leonidas-from-XIV/node-xml2js)
 * and xmlbuilder (https://github.com/oozcitak/xmlbuilder-js/)
 *
 * usage:
 * ```
 * const xmlStr = new ItoMConverter('/path/to/ibatis_mapper.xml').parse();
 * ```
 */
class ItoMConverter {

  private static MAY_ALIAS_ATTR = [
    'class',
    'parameterClass',
    'resultClass'
  ];

  private static NEED_CONVERTER: { [key: string]: string } = {
    class: 'type',
    parameterClass: 'parameterType',
    resultClass: 'resultType'
  };

  private static REGEX_IBATIS_ELEMENT: RegExp = /([$#])([a-zA-Z_0-9\[\]]+)(\.[a-zA-Z0-9]+)?(?::([a-zA-Z_0-9]+))?\1/g;

  private xml: builder.XMLElementOrXMLNode;
  private parser: xml2js.Parser;
  private filePath: string;
  // I will clear all typeAlias, here is alias map
  private typeAlias: { [key: string]: string } = {};
  // Record parameter map, fill in <procedure />
  private parameterMap: { [key: string]: ParameterMap } = {};

  private logger: Logger;

  constructor(filePath: string) {
    this.xml = builder.create('mapper', { encoding: 'UTF-8' });
    this.xml.dtd('-//mybatis.org//DTD Mapper 3.0//EN', 'http://mybatis.org/dtd/mybatis-3-mapper.dtd');

    const parser = new xml2js.Parser({
      explicitChildren: true,
      charsAsChildren: true,
      includeWhiteChars: true,
      preserveChildrenOrder: true,
      cdata: true,
      async: false
    });
    this.parser = parser;

    this.filePath = filePath;
    this.logger = new Logger(`ItoMConverter (${filePath})`);
  }

  // resolve result example: (It don't have type)
  // {
  //   '$': { namespace: 'ACCOUNOG' },
  //   '#name': 'sqlMap',
  //   '$$': [
  //     {
  //       '#name': TEXT_NODE_NAME,
  //       _: '\r\n    '
  //     },
  //     {  _: '\r\n\t\t  SELECT COUNT(ID) FROM OUNT,TRAID_\n\t\t  ) UNION ACCOUNOG\r\n\t',
  //        '$': [Object],
  //        '#name': 'select',
  //        '$$': [Array],
  //        include: [Array]
  //     },
  //     {
  //       '#name': TEXT_NODE_NAME,
  //       _: '\r\n    '
  //     }
  //   ],
  //   select: [
  //     {
  //       _: '\r\n\t\t  SELECT COUNT(ID) FROM OUNT,TRAID_\n\t\t  ) UNION ACCOUNOG\r\n\t',
  //        '$': [Object],
  //       '$$': [Array],
  //       include: [Array]
  //     }
  //   ]
  // }

  public parse = (cb: (xml: builder.XMLElementOrXMLNode) => void) => {
    fs.readFile(this.filePath, {}, (err: NodeJS.ErrnoException, data: Buffer) => {
      if (err) {
        throw err;
      }

      const elements: XmlElement[] = [];
      this.parser.parseString(data, (e: NodeJS.ErrnoException, r: any) => {
        // Loop root first children level tags
        for (const rootParsedKey in r.sqlMap) {
          if (!rootParsedKey) { continue; }
          const valueElement = r.sqlMap[rootParsedKey];

          switch (rootParsedKey) {
            case '$$':
              for (const index in valueElement) {
                if (!index) { continue; }
                const tag = valueElement[index];
                const tagName = tag['#name'];
                switch (tagName) {
                  case 'typeAlias':
                    this.parseTypeAlias(tag);
                    break;
                  case 'resultMap':
                    elements.push(this.parseResultMap(tag));
                    break;
                  case 'sql':
                  case 'select':
                  case 'insert':
                  case 'update':
                  case 'delete':
                    elements.push(this.parseNearlyRootElements(tag));
                    break;
                  case 'parameterMap': {
                    // Property info for procedure call
                    this.parseParameterMap(tag);
                    break;
                  }
                  case 'procedure': {
                    elements.push(this.parseProcedure(tag));
                    break;
                  }
                  case TEXT_NODE_NAME:
                    // Ignore text node from root
                    break;
                  default:
                    this.logger.error(`Root tag ${tagName} is unsupported,
                    please check your Mapper XML or post an issue.`);
                }
              }
              break;
            case '$':
              for (const rootAttr in valueElement) {
                if (!rootAttr) { continue; }
                this.xml.att(rootAttr, valueElement[rootAttr]);
              }
              continue;
            default:
              continue;
          }
        }
        this.buildXmlOnce(elements);
        cb(this.xml);
      });
    });
  }

  /**
   * Parse 'insert', 'delete', 'update', 'select', 'sql' tag
   */
  private parseNearlyRootElements = (element: any): XmlElement => {
    const elementName = element['#name'].trim();
    const children = element.$$;
    const attr = element.$;
    this.filterAttrsAndTranslate(attr);
    if (attr.remapResults) {
      this.logger.warn(`remapResults attr detected in id '${attr.id}', removed.`);
      delete attr.remapResults;
    }
    const resp: XmlElement = createXmlElement(elementName, attr);

    for (const childIndex in children) {
      if (!childIndex) { continue; }
      this.convertCommonSqlAndTags(resp, children[childIndex]);
    }

    return resp;
  }

  /**
   * Parse elements expect 'insert', 'delete', 'update', 'select', 'sql'
   *
   * Parsing rules:
   * - All `#property#` change to `#{property}`
   * - All `$property$` change to `#{property}`
   *
   * - In `<selectKey />`:
   *   - `resultClass` to `resultType`, and convert java.lang.Xxx to xxx
   *   - Don't modify keyProperty
   *   - Convert `type` attr to `order` addr, 'pre' -> 'before', 'post' -> 'after'
   *
   * - In `<isNotEmpty />`:
   *   - Replace by `<if />`
   *   - Simple prepend the value of `prepend` attr to text, and remove `prepend` attr
   *   - Change `property` attr to `test` attr, finally like `test="property != null and property != ''"`
   *   - IF parent is `trim`, and `prefixOverrides` attr is not set, then set to the value of `prepend`
   *
   * - In `<isEmpty />`:
   *   - Similar as `<isNotEmpty />`, change '!=' to '==', change 'and' to 'or'
   *
   * - In `<isNotNull />`:
   *   - Similar as `<isNotEmpty />` but no "` and property != ''`" in `test` attr
   *
   * - In `<isNull />`:
   *   - Similar as `<isNotNull />`, change '!=' to '=='
   *
   * - In `<isEqual />`:
   *   - Similar as `<isNotNull />`, change the `if` condition
   *
   * - In `<iterate />`:
   *   - Change `property` to `collection`
   *   - Change `conjunction` to `separator`
   *   - Keep `open` and `close` attr
   *   - Add `item="listItem"`
   *   - Assume the value of `property` tag is `theCollection`, convert `theCollection[]` to `listItem`
   *
   * - In `<dynamic />`:
   *   - If `prepend` attr is 'where' or 'set', then change `dynamic` tag to `where` or `set` tag
   *   - If `prepend` attr is not 'where' or 'set', then:
   *     - Convert to `trim` tag with `prefix` attr first
   *     - If all children is `<isNotNull />` or `<isNotEmpty />`, check if every tag has `prepend` attr,
   *       then add `prefixOverrides='thePrefix'` to `trim` tag
   *     - Else do not add anything to `trim` tag, just convert all children.
   *
   * - in `<include />`:
   *   - No modification
   */
  private convertCommonSqlAndTags = (parent: XmlElement, element: any) => {
    const elementName = element['#name'].trim();
    if (elementName === TEXT_NODE_NAME) {
      const originText = element._;
      if (originText && originText.trim() !== '') {
        parent.children.push(createXmlElement(TEXT_NODE_NAME, {}, [], this.filterElementText(originText)));
      }
    } else {
      const children = element.$$;
      const attr = element.$;
      this.filterAttrsAndTranslate(attr);

      switch (elementName) {
        case 'selectKey': {
          const newAttr: any = mapObject(attr, (newObj, key, value) => {
            if (value) {
              const trimValue = value.trim();
              switch (key) {
                case 'resultClass':
                  newObj.resultType = trimValue.replace('java.lang.', '').toLowerCase();
                  break;
                case 'type':
                  if ('post' === trimValue) {
                    newObj.order = 'AFTER';
                  } else {
                    newObj.order = 'BEFORE';
                  }
                  break;
                default:
                  newObj[key] = trimValue;
              }
            }
          });

          const resp: XmlElement = createXmlElement(elementName, newAttr);
          parent.children.push(resp);
          for (const childKey in children) {
            if (!childKey) { continue; }
            const child = children[childKey];
            this.convertCommonSqlAndTags(resp, child);
          }
          break;
        }
        case 'isNotEmpty': {
          this.parseAsIfTag(parent, attr, children, (value) => `${value} != null and ${value} != ''`);
          break;
        }
        case 'isNotNull': {
          this.parseAsIfTag(parent, attr, children, (value) => `${value} != null`);
          break;
        }
        case 'isEmpty': {
          this.parseAsIfTag(parent, attr, children, (value) => `${value} == null or ${value} == ''`);
          break;
        }
        case 'isNull': {
          this.parseAsIfTag(parent, attr, children, (value) => `${value} == null`);
          break;
        }
        case 'isEqual': {
          const cValue = attr.compareValue;
          if (cValue && (cValue === 'true' || cValue === 'false' || cValue.match(/^\d+$/))) {
            this.parseAsIfTag(parent, attr, children, (value) => `${value} == ${cValue}`);
          } else {
            this.parseAsIfTag(parent, attr, children, (value) => `'${value} == '${cValue}'`);
          }
          break;
        }
        case 'iterate': {
          const newAttr: any = mapObject(attr, (newObj, key, value) => {
            if (value) {
              const trimValue = value.trim();
              switch (key) {
                case 'property':
                  newObj.collection = trimValue;
                  break;
                case 'conjunction':
                  newObj.separator = trimValue;
                  break;
                case 'open':
                case 'close':
                  newObj[key] = trimValue;
                  break;
                default:
                  this.logger.debug(`Ignore <iterate /> attr '${key}'`);
              }
            }
          });
          newAttr.item = 'listItem';

          // Ibatis do not motherfuxking require 'collection' attr,
          // if not, find it in text node.
          if (!newAttr.collection) {
            for (const childKey in children) {
              if (!childKey) { continue; }
              const child = children[childKey];
              if (child._) {
                const groups = /#([a-zA-Z0-90]+)\[\]/.exec(child._);
                if (groups) {
                  newAttr.collection = groups[1];
                  break;
                }
              }
            }
          }
          if (!newAttr.collection) {
            this.logger.error(`An iterate tag don't have 'collection' attr!`);
          }

          const resp: XmlElement = createXmlElement('foreach', newAttr);
          parent.children.push(resp);
          for (const childKey in children) {
            if (!childKey) { continue; }
            const child = children[childKey];
            this.convertCommonSqlAndTags(resp, child);
          }

          // Replace `theCollection[]` to `listItem`
          const willReplaced = `${newAttr.collection}\[\]`;
          this.logger.debug('willReplaced', willReplaced);
          for (const childKey in resp.children) {
            if (!childKey) { continue; }
            const child = resp.children[childKey];
            if (child.text) {
              child.text = child.text.replace(willReplaced, 'listItem');
            }
          }
          break;
        }
        case 'dynamic': {
          const prefixOrigin = attr.prepend;
          let resp: XmlElement;
          if (!prefixOrigin) {
            this.logger.warn(`No 'prepend' attr found in dynamic!`);
            resp = createXmlElement(elementName, attr);
          } else {
            const prepend: string = prefixOrigin.trim();
            let newElementName: string;
            const newAttr: any = {};
            switch (prepend) {
              case 'where':
                newElementName = 'where';
                break;
              case 'set':
                newElementName = 'set';
                break;
              default:
                newElementName = 'trim';
                newAttr.prefix = prepend;
                // Find first element's 'prepend' attr, set to prefixOverrides
                if (children.length && children.length > 0) {
                  of((() => {
                    for (const index in children) {
                      if (!index) { continue; }
                      const child = children[index];
                      // Ignore empty text node
                      if (child['#name'] === TEXT_NODE_NAME && (!child._ || child._.trim() === '')) {
                        continue;
                      }
                      return child;
                    }
                  })())
                    .map((e: any) => e.$)
                    .map((atr: any) => atr.prepend)
                    .ifPresent((p: string) => {
                      newAttr.prefixOverrides = p;
                    });
                }
                break;
            }
            resp = createXmlElement(newElementName, newAttr);
          }
          parent.children.push(resp);
          for (const childKey in children) {
            if (!childKey) { continue; }
            const child = children[childKey];
            this.convertCommonSqlAndTags(resp, child);
          }
          break;
        }
        case 'include': {
          const resp: XmlElement = createXmlElement(elementName, attr);
          parent.children.push(resp);
          for (const childKey in children) {
            if (!childKey) { continue; }
            const child = children[childKey];
            this.convertCommonSqlAndTags(resp, child);
          }
          break;
        }
        default: {
          this.logger.error(`Unknown tag ${elementName} detected.`);
          const resp: XmlElement = createXmlElement(elementName, attr);
          parent.children.push(resp);
          for (const childKey in children) {
            if (!childKey) { continue; }
            const child = children[childKey];
            this.convertCommonSqlAndTags(resp, child);
          }
          break;
        }
      }

    }
  }

  private buildXmlOnce = (elements: XmlElement[]) => {
    const recursive = (parent: builder.XMLElementOrXMLNode, element: XmlElement) => {
      const eName = element.name;
      // Check if it's text node
      if (eName === TEXT_NODE_NAME) {
        // Text node is text only
        if (element.text) {
          if (element.text.match(/[<>]/)) {
            parent.cdata(element.text);
          } else {
            parent.raw(element.text);
          }
        } else {
          this.logger.warn('Empty text node detected, it\'s parent is:', JSON.stringify(parent.element));
        }
      } else {
        // Non text node will recursively resolve
        const currentElement: builder.XMLElementOrXMLNode = parent.ele(element.name);
        for (const i in element.attr) {
          if (!i) { continue; }
          const attrValue = element.attr[i];
          if (attrValue === undefined || attrValue === null) {
            this.logger.warn(`attr ${i} is null`);
            throw new Error(`attr ${i} is null`);
          }
          currentElement.att(i, attrValue);
        }
        if (element.text) {
          if (element.text.match(/[<>]/)) {
            currentElement.cdata(element.text);
          } else {
            currentElement.text(element.text);
          }
        }
        element.children.forEach((child: XmlElement) => { recursive(currentElement, child); });
      }
    };

    for (const index in elements) {
      if (!index) { continue; }
      const element: XmlElement = elements[index];
      recursive(this.xml, element);
    }

    return this.xml;
  }

  /**
   * Add a type alias to this.typeAlias.
   * ```
   * <typeAlias alias="x" type="com.abomb4.X" />
   * ```
   *
   * As usual, `<typeAlias />` tag always on the top of mapper xml.
   */
  private parseTypeAlias = (element: any): void => {
    const key: string = element.$.alias;
    const value: string = element.$.type;
    this.typeAlias[key] = value;
  }

  /**
   * A resultMap just like:
   * ```
   * <resultMap id="theId" class="aliased">
   *   <result column="ID" property="id" />
   *   <result column="USER_NAME" property="user_name" />
   *   <result column="PASSWORD" property="password" />
   * </resultMap>
   * ```
   */
  private parseResultMap = (element: any): XmlElement => {
    const children = element.$$;
    const attr = element.$;
    this.filterAttrsAndTranslate(attr);
    const resp: XmlElement = createXmlElement('resultMap', attr,
      children.filter((result: any) => {
        const name = result['#name'];
        return 'result' === name || 'id' === name;
      }).map((result: any) => {
        // Convert <result />
        const a = result.$;
        if (a.jdbcType) {
          a.jdbcType = a.jdbcType.toUpperCase();
        }
        if (a.select && a.column) {
          return createXmlElement('association', a, [], result[TEXT_NODE_NAME]);
        } else {
          delete a.nullValue;
          return createXmlElement(result['#name'], a, [], result[TEXT_NODE_NAME]);
        }
      })
    );

    return resp;
  }

  /**
   * `parameterMap` is properties defination in a procedure call.
   *
   * A parameterMap just like:
   * ```
   * <parameterMap id="theId" class="map" >
   *   <parameter property="NAME" mode="IN" jdbcType="VARCHAR" javaType="java.lang.String"/>
   *   <parameter property="EMAIL" mode="IN" jdbcType="VARCHAR" javaType="java.lang.String"/>
   *   <parameter property="resultFlag" mode="OUT"  jdbcType="VARCHAR" javaType="java.lang.String"/>
   *   <parameter property="resultMsg" mode="OUT" jdbcType="VARCHAR" javaType="java.lang.String"/>
   * </parameterMap>
   * ```
   */
  private parseParameterMap(element: any): void {
    const children: any[] = element.$$;
    const attr: any = element.$;

    const resp: ParameterMap = {
      class: attr.class,
      id: attr.id,
      parameters: []
    };

    if (resp.class === 'map') {
      resp.class = 'java.util.Map';
    }

    for (const index in children) {
      if (!index) { continue; }
      const child = children[index];
      if (child['#name'] !== 'parameter') {
        continue;
      }
      const cAttr = child.$;
      resp.parameters.push(createParameterMapParameter(cAttr.property, cAttr.mode, cAttr.jdbcType, cAttr.javaType));
    }

    this.parameterMap[resp.id] = resp;
  }

  /**
   * Parse 'procedure` tag.
   * Let's union it to `<select />` tag;
   */
  private parseProcedure = (element: any): XmlElement => {
    const children = element.$$;
    const attr = element.$;
    this.filterAttrsAndTranslate(attr);
    const newAttr: {[key: string]: string} = {};
    let parameterMap: ParameterMap | undefined;
    {
      for (const key in attr) {
        if (!key) { continue; }
        const value = attr[key];
        if (key === 'parameterMap') {
          // Try translate
          parameterMap = this.parameterMap[value];
          if (!parameterMap) {
            throw new Error(`Cannot found 'parameterMap' by key '${value}', please check your <procedure /> tag.`);
          }
          newAttr.parameterType = parameterMap.class;
        } else {
          newAttr[key] = value;
        }
      }
    }
    const resp: XmlElement = createXmlElement('select', newAttr);

    // Procedure may have two form:
    // 1. call some_procedure(?, ?, ?)
    // 2. call some_procedure(#aaa#, #bbb#, #ccc#)
    // Currently, only mode 1 is supported.
    let procedureJoin: string = '';
    for (const childIndex in children) {
      if (!childIndex) { continue; }
      procedureJoin = procedureJoin + children[childIndex]._;
    }

    if (procedureJoin.match(/\?/)) {
      if (!parameterMap) {
        throw new Error(`Found '?' in procedure but parameterMap '${attr.parameterMap}' not found.`);
      }

      for (const param of parameterMap.parameters) {
        const prop = `${LINE_SEPARATOR}#{${param.property},mode=${param.mode},jdbcType=${param.jdbcType}}`;
        procedureJoin = procedureJoin.replace(/\?/, prop);
      }
    }
    resp.text = this.filterElementText(procedureJoin);
    resp.text = resp.text;

    return resp;
  }

  /**
   * Parse an ibatis tag to `<if />` tag, extract common code
   *
   * @param parent Parent of current tag
   * @param attr Attributes parsed by `xml2js`
   * @param children Children parsed by `xml2js` (`$` param), it's a list
   * @param test How to generate `test` attr
   */
  private parseAsIfTag(parent: XmlElement, attr: any, children: any[], test: ((property: string) => string)) {

    const resp: XmlElement = createXmlElement('if');
    let prependText: string | undefined;
    const newAttr: any = mapObject(attr, (newObj, key, originValue) => {
      if (originValue) {
        const value = originValue.trim();
        switch (key) {
          case 'prepend':
            prependText = value;
            break;
          case 'property':
            newObj.test = test(value);
            break;
          default:
            this.logger.debug(`Ignore <if /> attr '${key}'`);
        }
      }
    });
    if (prependText) {
      prependText = prependText.trim();
    }

    // Someone don't write 'property' attr to <isNotEmpty /> etc tag
    if (!newAttr.test) {
      this.logger.warn(`There have a tag don't contains 'property' attr, so remove <if /> tag.`);
      parent.children.push(createXmlElement(TEXT_NODE_NAME, {}, [], prependText));
      for (const childKey in children) {
        if (!childKey) { continue; }
        const child = children[childKey];
        this.convertCommonSqlAndTags(parent, child);
      }
    } else {
      resp.attr = newAttr;
      parent.children.push(resp);

      for (const childKey in children) {
        if (!childKey) { continue; }
        const child = children[childKey];
        this.convertCommonSqlAndTags(resp, child);
      }
      const mayText = resp.children[0];
      if (prependText && mayText && mayText.text) {
        if (parent.name === 'set') {
          // Ibatis <dynamic prepend="set" /> supports prefix ',' in child,
          // but MyBatis only supports suffix.
          mayText.text = `${mayText.text} ${prependText}`;
        } else {
          mayText.text = `${prependText} ${mayText.text} `;
        }
      }
    }
  }

  /**
   * Convert All `#property:VARCHAR#` change to `#{property,jdbcType=VARCHAR}`,
   * convert All `$property$` change to `#{property}`
   *
   * @param text The non-null and non-undefined text string
   */
  private filterElementText(text: string): string {
    const regex = ItoMConverter.REGEX_IBATIS_ELEMENT;
    const trimedText = text.trim().replace(/\r\n/g, LINE_SEPARATOR);
    const matches = trimedText.match(regex);
    if (matches) {
      let newText: string = trimedText;
      matches.forEach((matchStr: string) => {
        const match = regex.exec(matchStr);
        if (!match) {
          throw new Error(`regex.exec(matchStr) panic ${regex}.exec('${matchStr}')`);
        }
        const eName = match[2];
        const eProp = match[3];
        const eType = match[4];
        let mybatis: string = '#{' + eName;
        if (eProp) {
          mybatis += eProp;
        }
        if (eType) {
          mybatis += ',jdbcType=' + eType;
        }
        mybatis += '}';
        newText = newText.replace(matchStr, mybatis);

        regex.lastIndex = 0;
      });
      return newText;
    } else {
      return trimedText;
    }
  }

  /**
   * Try translate ALL aliased type to real class and convert attr name
   */
  private filterAttrsAndTranslate = (obj: any) => {
    // Check alias
    for (const index in ItoMConverter.MAY_ALIAS_ATTR) {
      if (!index) { continue; }
      const key = ItoMConverter.MAY_ALIAS_ATTR[index];
      const value: string | undefined = obj[key];
      if (value) {
        // Trim it
        const trimValue = value.trim();
        if (trimValue !== value) {
          obj[key] = trimValue;
        }

        // Find alias
        const real: string | undefined = this.typeAlias[trimValue];
        if (real) {
          this.logger.debug(`translate alias key "${key}" from "${value}" to "${real}"`);
          obj[key] = real;
        }
      }
    }

    // modify attr name
    for (const index in obj) {
      if (!index) { continue; }
      const mayNeedConvert = ItoMConverter.NEED_CONVERTER[index];
      if (mayNeedConvert) {
        const v = obj[index];
        delete obj[index];
        obj[mayNeedConvert] = v;
      }
    }
  }
}

export function parse(path: string, cb: ((xml: builder.XMLElementOrXMLNode) => void)) {
  new ItoMConverter(path).parse(cb);
}
