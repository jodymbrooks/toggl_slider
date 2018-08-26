import TogglClient from 'toggl-api';
import { togglApiToken} from './config'

class togglServices {

  constructor() {
    this.toggl = new TogglClient({apiToken: togglApiToken});
  }

  getTimeEntries = (start, end) => {
    const promise = new Promise((resolve, reject) => {
      this.toggl.getTimeEntries(start, end, (err, timeEntries) => {
        if (err) {
          reject(Error(err));
        }
        else {
          resolve(timeEntries);
        }
      });
    });

    return promise;
  }



  updateTimeEntry = (timeEntry) => {
    const promise = new Promise((resolve, reject) => {
      this.toggl.updateTimeEntry(timeEntry.id, timeEntry, (err, timeEntry) => {
        if (err) {
          reject(Error(err));
        }
        else {
          resolve(timeEntry);
        }
      });
    });

    return promise;
  }

}

export default togglServices;
