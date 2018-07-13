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
          <v-btn
            :disabled="!airTableValid"
            @click="fetchAirTableData"
          >
            Fetch your data
          </v-btn>
        </v-form>

        <v-form v-if="airTableDataLoaded" v-model="tableauValid">
          <v-btn
            :disabled="!tableauValid"
            @click="makeTableauTables"
          >
            Send data to tableau
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
      apiKey: 'key0XkybVzTXtWZYq',
      airTableValid: false,
      airTableDataLoaded: false,
      tableauValid: false,
      bases: [],
      allRecords: [],
    }
  },

  methods: {
    async fetchAirTableData() {
      airtable.configure({
          endpointUrl: 'https://api.airtable.com',
          apiKey: this.apiKey,
      })
      const base = airtable.base('app7Abi7yfxc4z2mD')

      await base('Table 1').select({
          // Selecting the first 3 records in Grid view:
          maxRecords: 3,
          view: "Grid view"
      }).eachPage((records, fetchNextPage) => {
        records = records.filter(r => r.fields)
        this.allRecords = this.allRecords.concat(records)
        fetchNextPage()
      })
      this.airTableDataLoaded = true
    },

    makeTableauTables() {
      const cols = Object.keys(this.allRecords[0].fields).map(k => ({
        id: k,
        dataType: tableau.dataTypeEnum.string,
      }))

      const tableSchema = {
          id: "table1",
          alias: "First test table",
          columns: cols
      }

      const table = this.allRecords.map(r => r.fields)

      const connectionData = {
        schema: [tableSchema],
        table,
      }

      console.log(connectionData)

      tableau.connectionData = JSON.stringify(connectionData)
      tableau.connectionName = "AirTable Feed"
      tableau.submit()
    },
  }
}
</script>
