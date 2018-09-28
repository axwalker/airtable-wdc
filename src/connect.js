/* global tableau, myConnector */
import airtable from 'airtable'


window.myConnector = tableau.makeConnector()

myConnector.getSchema = async function(schemaCallback) {
  let { schema } = JSON.parse(tableau.connectionData)

  const tableSchemas = schema.map(ts => ({
    id: ts.name.replace(/[^\w]/g, '_'),
    columns: ts.columns.map(cs => parseColumnSchema(cs)),
  }))
  
  schemaCallback(tableSchemas)
}

myConnector.getData = async function(table, doneCallback) {
  let { apiKey, base, schema } = JSON.parse(tableau.connectionData)
  airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: apiKey,
  })
  base = airtable.base(base)
  const allRecords = {}

  // TODO: don't get every table for every getData call - should only
  // need to get the data for the table currently being used
  for (let { name } of schema) {
    await base(name).select().eachPage((records, fetchNextPage) => {
      records = records.filter(r => Object.keys(r.fields).length)
      allRecords[name] = (allRecords[name] || []).concat(records)
      fetchNextPage()
    })
  }

  let tables = {}
  for (let { name } of schema) {
    const rows = allRecords[name]
      .map(r => r.fields)
      .map(r => {
        const mapped = {}
        for (let [alias, value] of Object.entries(r)) {
          mapped[alias.replace(/[^\w]/g, '_')] = value
        }
        return mapped
      })
    tables[name.replace(/[^\w]/g, '_')] = rows
  }

  table.appendRows(tables[table.tableInfo.id])
  doneCallback()
}

tableau.registerConnector(myConnector)


function parseColumnSchema({name, type}) {
  const tableauTypes = {
    checkbox: tableau.dataTypeEnum.bool,
    date: tableau.dataTypeEnum.date,
    datetime: tableau.dataTypeEnum.date,
    foreignKey: tableau.dataTypeEnum.string,
    multiSelect: tableau.dataTypeEnum.string,
    multilineText: tableau.dataTypeEnum.string,
    multipleAttachment: tableau.dataTypeEnum.string,
    select: tableau.dataTypeEnum.string,
    text: tableau.dataTypeEnum.string,
    number: tableau.dataTypeEnum.float,
    rating: tableau.dataTypeEnum.float,
  }
  const dataType = tableauTypes[type] || tableau.dataTypeEnum.string

  return {
    id: name.replace(/[^\w]/g, '_'),
    dataType,
  }
}
