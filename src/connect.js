/* global tableau, myConnector */
import airtable from 'airtable'


window.myConnector = tableau.makeConnector()

myConnector.getSchema = async function(schemaCallback) {
  let connectionData = JSON.parse(tableau.connectionData)

  const tableSchemas = connectionData.schema.map(ts => ({
    id: ts.name.replace(/[^\w]/g, '_'),
    columns: ts.columns.map(cs => parseColumnSchema(cs)),
  }))

  // Table names in tableau have had non-word characters removed, but we still
  // need to find them in `getData` with their original name, so we pass
  // through a name mapping to the next stage.
  const tableMap = {}
  connectionData.schema.forEach(ts => {
    const corrected_name = ts.name.replace(/[^\w]/g, '_')
    tableMap[corrected_name] = ts.name
  })

  connectionData = {
    ...connectionData,
    tableMap,
  }

  tableau.connectionData = JSON.stringify(connectionData)
  schemaCallback(tableSchemas)
}

myConnector.getData = async function(table, doneCallback) {
  let { apiKey, base, tableMap } = JSON.parse(tableau.connectionData)
  airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: apiKey,
  })
  base = airtable.base(base)

  // Get the original airtable name given the (possibly different) tableau name
  const tableName = tableMap[table.tableInfo.id]
  let allRecords = []
  await base(tableName).select().eachPage((records, fetchNextPage) => {
    records = records.filter(r => Object.keys(r.fields).length)
    allRecords = allRecords.concat(records)
    fetchNextPage()
  })

  const rows = allRecords
    .map(r => r.fields)
    .map(r => {
      const mapped = {}
      for (let [alias, value] of Object.entries(r)) {
        mapped[alias.replace(/[^\w]/g, '_')] = value
      }
      return mapped
    })

  table.appendRows(rows)
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
