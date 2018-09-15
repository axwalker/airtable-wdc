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
              label="Base id"
              placeholder="Enter the Airtable base"
              required
            />
          </v-flex>

          <v-flex xs12>
            <v-text-field
              v-model="schemaInput"
              :rules="[v => !!v || 'Item is required']"
              label="Schema (Chrome extension: https://tinyurl.com/ych9l2fv)"
              placeholder="Enter your airtable schema"
              required
            />
          </v-flex>

          <v-flex>
            <v-text-field
              :value="`${url}?${queryString}`"
              label="URL to use later"
              outline
              disabled
            ></v-text-field>
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
import JsonUrl from 'json-url'

// workaround for this issue: https://github.com/masotime/json-url/issues/5
import 'json-url/dist/browser/json-url-msgpack'
import 'json-url/dist/browser/json-url-lzw'
import 'json-url/dist/browser/json-url-lzma'
import 'json-url/dist/browser/json-url-lzstring'
import 'json-url/dist/browser/json-url-safe64'
const lzma = JsonUrl('lzma')


export default {
  name: 'App',

  data () {
    return {
      apiKey: '',
      base: '',
      schemaInput: '',
      airTableValid: false,
      allRecords: {},
      url: [location.protocol, '//', location.host, location.pathname].join(''),
    }
  },

  computed: {
    schema() {
      return JSON.parse(this.schemaInput || '{}')
    },
    queryString() {
      return [['apiKey', this.apiKey], ['base', this.base], ['schema', this.schemaEncoded]]
        .filter(pair => pair[1])
        .map(([ key, value ]) => `${key}=${value}`)
        .join('&')
    }
  },

  asyncComputed: {
    async schemaEncoded() {
      if (this.schema.length) {
        return await lzma.compress(this.schema)
      }
    },
  },

  async created() {
    window.codec = JsonUrl
    this.apiKey = getParameterByName('apiKey')
    this.base = getParameterByName('base')
    let schema = getParameterByName('schema')
    if (schema) {
      schema = await lzma.decompress(schema)
      this.schemaInput = JSON.stringify(schema)
    }
    if (this.apiKey && this.base && this.schemaInput) {
      this.fetchAirTableData()
    }
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
        id: ts.name.replace(/[^\w]/g, '_'),
        columns: ts.columns.map(cs => this.parseColumnSchema(cs)),
      }))

      let tables = {}
      for (let { name } of this.schema) {
        const rows = this.allRecords[name]
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
        id: name.replace(/[^\w]/g, '_'),
        dataType,
      }
    },
  }
}

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
</script>
