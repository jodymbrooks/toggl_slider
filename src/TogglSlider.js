import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import React, { Component } from 'react';
import Slider from 'rc-slider';

import togglServices from './togglServices';

const Range = Slider.createSliderWithTooltip(Slider.Range);


class TogglSlider extends Component {
  constructor(props) {
    super(props);

    this.togglSvcs = new togglServices();
    this.sendRangeChangeTimer = null;

    this.state = {
      entries: null,
      min: null,
      max: null,
      times: []
    };

    this.loadTodaysTimeEntries()
      .then(timeEntryInfo => {
        this.setState(timeEntryInfo);
      })
      .catch(error => {
        console.log(`Error fetching time entry info: ${error}`);
      });
  }

  getDateWithNoSeconds = (date) => {
    date.setHours(date.getHours(), date.getMinutes(), 0, 0);
    return date;
  }

  loadTodaysTimeEntries = async () => {
    let rangeStart = new Date('8/24/2018');
    // let rangeStart = new Date(); // today
    rangeStart.setHours(0, 0, 0, 0);

    let rangeStop = new Date(rangeStart.getTime());
    rangeStop.setHours(23, 59, 59, 999);

    try {
      const timeEntries = await this.togglSvcs.getTimeEntries(rangeStart, rangeStop);

      return this.processTimeEntries(timeEntries, /*calcMinMax*/true);
    }
    catch (error) {
      console.log(error);
    }

    return null;
  }

  processTimeEntries = (timeEntries, calculateMinMax) => {
    let earliestDate = null;
    let earliestTime = null;
    let latestDate = null;
    let latestTime = null;

    const times = [];
    let entries = timeEntries.map((timeEntry, index) => {
      if (!timeEntry.stop) { // means the entry is still in progress
        timeEntry.stop = (new Date()).getTime(); // shove in "now" time so new Date(timeEntry.stop) will create is as now
        timeEntry.isInProgress = true;
      }

      // 1) Return a copy of the timeEntry adding Date object and its corresponding time (epoch seconds int) value
      //    for both start and stop properties. Round these to even minutes.
      //      - The entry may already have all this data if set from onChange handler
      // 2) Find the earliest and latest times for calculating some extra buffer on end of the range
      if (!timeEntry.startDate) {
        timeEntry.startDate = this.getDateWithNoSeconds(new Date(timeEntry.start));  // round everything to even minutes
        timeEntry.startDateTime = timeEntry.startDate.getTime();
        timeEntry.stopDate = this.getDateWithNoSeconds(new Date(timeEntry.stop));
        timeEntry.stopDateTime = timeEntry.stopDate.getTime();
      }
      const startDateTime = timeEntry.startDateTime;
      const stopDateTime = timeEntry.stopDateTime;


      const newTimeEntry = { ...timeEntry };

      // Keep up with the earliest and latest times so can determine min and max for sliders
      if (!earliestTime || newTimeEntry.startDateTime < earliestTime) {
        earliestDate = newTimeEntry.startDate;
        earliestTime = newTimeEntry.startDateTime;
      }

      if (!latestTime || newTimeEntry.stopDateTime > latestTime) {
        latestDate = newTimeEntry.stopDate;
        latestTime = newTimeEntry.stopDateTime;
      }

      // Keep times hash for quick look up
      if (!times[startDateTime]) {
        times[startDateTime] = [];
      }
      times[startDateTime].push(newTimeEntry);

      if (!times[stopDateTime]) {
        times[stopDateTime] = [];
      }
      times[stopDateTime].push(timeEntry);

      return newTimeEntry;
    });

    entries = this.getLinkedEntries(entries);

    if (!calculateMinMax) {
      return { entries, times };
    }
    // else ...

    const buffer = 1; // how much extra time (rounded) to show on each end of the time range so user can correct first start and last stop if needed
    const min = (new Date(earliestDate)).setHours(earliestDate.getHours() - buffer, 0, 0, 0);
    const max = (new Date(latestDate)).setHours(latestDate.getHours() + buffer + 1, 0, 0, 0);

    return { entries, times, min, max };
  }

  getLinkedEntries = (timeEntries) => {
    return timeEntries.map((timeEntry, index) => {
      const syncValidDelta = 1;

      // Check if the next entry's start is linked to this entry's stop
      let linkedToStopIndex = index + 1;
      // If this index is past the end of the array or
      // if the stop of this does not match the start of the next,
      // then there's no entry linked to this entry's stop time
      if (linkedToStopIndex >= timeEntries.length ||
          Math.abs(timeEntry.stopDateTime - timeEntries[linkedToStopIndex].startDateTimes) < syncValidDelta) {
            linkedToStopIndex = null;
      }

      // Check if the previous entry's stop is linked to this entry's start
      let linkedToStartIndex = index - 1;
      // If this index is prior to the begining of the array or
      // if the start of this does not match the stop of the previous,
      // then there's no entry linked to this entry's start time
      if (linkedToStartIndex < 0 ||
          Math.abs(timeEntry.startDateTime - timeEntries[linkedToStartIndex].stopDateTime) < syncValidDelta) {
          linkedToStartIndex = null;
      }

      timeEntry.linkedToStopIndex = linkedToStopIndex;
      timeEntry.linkedToStartIndex = linkedToStartIndex;

      return timeEntry;
    });
  }

  formatTip = (time, entry, index) => {
    // const isStartTime = (time === entry.startDateTime);

    // const tip = isStartTime 
    //   ? this.formatTimeAsHrMinString(time) + " " + entry.description
    //   : entry.description + " " + this.formatTimeAsHrMinString(time);

    const tip = this.formatTimeAsHrMinString(entry.startDateTime) + " - " + entry.description + " - " + this.formatTimeAsHrMinString(entry.stopDateTime);


    return tip;
  }

  formatTimeAsHrMinString = (time) => {
    const date = new Date(time);

    let ampm = "am";
    let hours = date.getHours();
    if (hours > 12) {
      hours -= 12;
      ampm = "pm";
    }
    const minutes = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2, useGrouping: false });

    const timeStr = `${hours}:${minutes} ${ampm}`;

    return timeStr;
  }

  handleRangeChange = (valueArray, entryPriorToChange, index) => {
    // valueArray is the array of start and stop times, one of which has likely changed from its previous value
    const [startDateTime, stopDateTime] = valueArray;

    // Is user changing the end of an earlier entry? (i.e. the start hasn't changed)
    const startChanged = (startDateTime !== entryPriorToChange.startDateTime);
    const stopChanged = (stopDateTime !== entryPriorToChange.stopDateTime);

    if (!startChanged && !stopChanged) {
      return;
    }

    const indexEntry = { ...entryPriorToChange }; // copy entry's previous data as we will be changing it
    let entries = [...this.state.entries];

    const { linkedToStartIndex, linkedToStopIndex } = indexEntry;
    let linkedEntry = null;

    // Make corresponding changes to the given entry and possibly a linked entry
    if (stopChanged) {
      const stopDate = new Date(stopDateTime);
      const stop = stopDate.toISOString();

      indexEntry.stopDate = stopDate;
      indexEntry.stopDateTime = stopDateTime;
      indexEntry.stop = stop;

      // See if there's an entry linked to the changed stop time of the given entry.
      // If so, update its start time to match the stop time of the given entry.
      if (linkedToStopIndex !== null) { // has an entry linked to the stop
        linkedEntry = { ...this.state.entries[linkedToStopIndex] }
        linkedEntry.startDate = stopDate; // use the stop of the given entry as the start of the linked entry
        linkedEntry.startDateTime = stopDateTime;
        linkedEntry.start = stop;
        entries[linkedToStopIndex] = linkedEntry;
      }
    }

    if (startChanged) {
      const startDate = new Date(startDateTime);
      const start = startDate.toISOString(); // get the ISO strings that toggl will want

      indexEntry.startDate = startDate;
      indexEntry.startDateTime = startDateTime;
      indexEntry.start = start;

      // See if there's an entry linked to the changed start time of the given entry.
      // If so, update its stop time to match the start time of the given entry.
      if (linkedToStartIndex !== null) {
        // not past the end of the array so there is a linked entry... update it
        linkedEntry = { ...this.state.entries[linkedToStartIndex] }
        linkedEntry.stopDate = startDate; // use the start of the given entry as the stop of the linked entry
        linkedEntry.stopDateTime = startDateTime;
        linkedEntry.stop = start;
        entries[linkedToStartIndex] = linkedEntry;
      }
    }

    // Update the entry in the array so can put back in the state
    // -- Doing so here in case somehow the start AND the stop could change (not sure if the Range component can do that or not)
    entries[index] = indexEntry;

    const newStateInfo = this.processTimeEntries(entries, /*calcMinMax*/false);

    this.setState(newStateInfo);

    if (this.sendRangeChangeTimer !== null) {
      window.clearTimeout(this.sendRangeChangeTimer);
    }
    this.sendRangeChangeTimer = window.setTimeout(() => {
      this.togglSvcs.updateTimeEntry(indexEntry); // these calls return a promise but we're not waiting on it
      if (linkedEntry) {
        this.togglSvcs.updateTimeEntry(linkedEntry);
      }
      this.sendRangeChangeTimer = null;
    }, 1000);
  }


  render() {
    const { entries, min, max } = this.state;

    if (!entries) return null;

    //<input type="checkbox" checked={entry.startLinkedToPrevStop} style={{display: entry.startLinkedToPrevStop===null ? 'none': 'inline-block'}}/>

    const entriesList = entries.map((entry, index) => {
      return (
        <div key={entry.id} className="entry">
          <div className="description">{entry.description}</div>
          <Range
            min={min} max={max} step={60000}
            allowCross={false} disabled={entry.isInProgress}
            value={[entry.startDateTime, entry.stopDateTime]}
            tipFormatter={value => this.formatTip(value, entry, index)}
            onChange={value => this.handleRangeChange(value, entry, index)}
          />
        </div>
      );
    })

    return (
      <div className="TogglSlider">
        {entriesList}
      </div>
    );
  }
}

export default TogglSlider;
