import * as fs from 'fs';
import * as xml2js from 'xml2js';
import * as builder from 'xmlbuilder';

interface XmlElement {
  name: string,
  attr: { [key: string]: string },
  children: XmlElement[],
  text?: string
}

const TEXT_NODE_NAME = '__text__';

/**
 * Based on xml2js (https://github.com/Leonidas-from-XIV/node-xml2js)
 * and xmlbuilder (https://github.com/oozcitak/xmlbuilder-js/)
 */
export class ItoMConverter {
  private xml: builder.XMLElementOrXMLNode;
  private parser: xml2js.Parser;
  private filePath: string;
  // I will clear all typeAlias, here is alias map
  private typeAlias: { [key: string]: string } = {};

  constructor(filePath: string) {
    this.xml = builder.create('mapper');
    this.xml.dtd('-//mybatis.org//DTD Mapper 3.0//EN', 'http://mybatis.org/dtd/mybatis-3-mapper.dtd');

    const parser = new xml2js.Parser({
      explicitChildren: true,
      charsAsChildren: true,
      includeWhiteChars: true,
      preserveChildrenOrder: true
    });
    this.parser = parser;

    this.filePath = filePath;
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

  public parse: (() => string) = () => {
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
                    elements.push(this.parseSql(tag));
                    break;
                  case 'select':
                    elements.push(this.parseSelect(tag));
                    break;
                  case 'insert':
                    elements.push(this.parseInsert(tag));
                    break;
                  case 'update':
                    elements.push(this.parseUpdate(tag));
                    break;
                  case 'delete':
                    elements.push(this.parseDelete(tag));
                    break;
                  case TEXT_NODE_NAME:
                    // Ignore text node from root
                    break;
                  default:
                    console.error(`Root tag ${tagName} is unsupported, please check your Mapper XML or post an issue.`);
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
        console.log(this.xml.toString({
          pretty: true
        }));
      });
    });
    return '';
  }

  private buildXmlOnce = (elements: XmlElement[]) => {
    const recursive = (parent: builder.XMLElementOrXMLNode, element: XmlElement) => {
      const currentElement: builder.XMLElementOrXMLNode = parent.ele(element.name);
      for (const i in element.attr) {
        if (!i) { continue; }
        currentElement.att(i, element.attr[i]);
      }
      if (element.text) {
        currentElement.text(element.text);
      }
      element.children.forEach((child: XmlElement) => { recursive(currentElement, child); });
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
    const resp: XmlElement = {
      name: 'resultMap',
      attr,
      children: children.filter((result: any) => {
        return result['#name'] !== TEXT_NODE_NAME;
      }).map((result: any) => {
        return {
          name: result['#name'],
          attr: result.$,
          children: []
        };
      })
    };

    return resp;
  }
  private parseSql = (element: any): XmlElement => {
    return {
      name: 'sql',
      attr: {},
      children: []
    };
  }
  private parseSelect = (element: any): XmlElement => {

    return {
      name: 'select',
      attr: {},
      children: []
    };
  }
  private parseInsert = (element: any): XmlElement => {

    return {
      name: 'insert',
      attr: {},
      children: []
    };
  }
  private parseUpdate = (element: any): XmlElement => {

    return {
      name: 'update',
      attr: {},
      children: []
    };
  }
  private parseDelete = (element: any): XmlElement => {

    return {
      name: 'delete',
      attr: {},
      children: []
    };
  }
}
