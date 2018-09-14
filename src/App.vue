<template>
  <v-app>
    <v-toolbar app>Airtable WebDataConnector</v-toolbar>
    <v-content>
      <v-container fluid>

        <v-form v-model="airTableValid">

          <v-flex xs12>
            <v-text-field
              v-model="apiKey"
              :rules="[v => !!v || 'Item is required']"
              label="API Key"
              placeholder="Enter your AirTable API key"
              required
            />
          </v-flex>

          <v-flex xs12>
            <v-text-field
              v-model="base"
              :rules="[v => !!v || 'Item is required']"
              label="Base"
              placeholder="Enter the Airtable base"
              required
            />
          </v-flex>

          <v-flex xs12>
            <v-text-field
              v-model="schemaInput"
              :rules="[v => !!v || 'Item is required']"
              label="Schema"
              placeholder="Enter your airtable schema"
              required
            />
          </v-flex>

          <v-btn
            :disabled="!airTableValid"
            @click="fetchAirTableData"
          >
            Load your airtable data
          </v-btn>

        </v-form>
      </v-container>
    </v-content>
  </v-app>
</template>

<script>
/* global tableau */
import airtable from 'airtable'

export default {
  name: 'App',

  data () {
    return {
      apiKey: '',
      base: '',
      schemaInput: '',
      airTableValid: false,
      allRecords: {},
    }
  },

  computed: {
    schema() {
      return JSON.parse(this.schemaInput)
    },
  },

  methods: {
    async fetchAirTableData() {
      airtable.configure({
          endpointUrl: 'https://api.airtable.com',
          apiKey: this.apiKey,
      })
      const base = airtable.base(this.base)

      for (let { name } of this.schema) {
        await base(name).select().eachPage((records, fetchNextPage) => {
          records = records.filter(r => Object.keys(r.fields).length)
          this.allRecords[name] = (this.allRecords[name] || []).concat(records)
          fetchNextPage()
        })
      }

      const tableSchemas = this.schema.map(ts => ({
        id: ts.name.replace(/ /g, '_'),
        columns: ts.columns.map(cs => this.parseColumnSchema(cs)),
      }))

      let tables = {}
      for (let { name } of this.schema) {
        const rows = this.allRecords[name]
          .map(r => r.fields)
          .map(r => {
            const mapped = {}
            for (let [alias, value] of Object.entries(r)) {
              mapped[alias.replace(/ /g, '_')] = value
            }
            return mapped
          })
        tables[name.replace(/ /g, '_')] = rows
      }

      const connectionData = {
        schema: tableSchemas,
        tables,
      }

      tableau.connectionData = JSON.stringify(connectionData)
      tableau.connectionName = "AirTable Feed"
      tableau.submit()
    },

    parseColumnSchema({name, type}) {
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
        id: name.replace(/ /g, '_'),
        dataType,
      }
    }
  }
}
</script>
