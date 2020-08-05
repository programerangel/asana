const asana = require('asana');
const converter = require('json-2-csv');
const fs = require('fs'); 
const client = asana.Client.create().useAccessToken(process.env.ASANA_TOKEN);
// const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHET_KEY);

function createCSV (csv, filename) {
  return new Promise(function(resolve, reject) {
    fs.writeFile('csv/'+filename, csv, function(err) {
      if (err) throw err;
      console.log(filename + ' saved');
      resolve();
    });
  });
}
module.exports = {
  async connect (req, res) {
    try {
      let user = await client.users.me()
      const userId = user.gid;
      const workspaceId = user.workspaces[0].gid;
      let projects = await client.projects.getProjects({
        workspace: workspaceId,
        opt_pretty: true
      })
      let tasks = await Promise.all(
        projects.data.map(async project => {
          const tasksByProject = await client.tasks.getTasksForProject(project.gid, {
            opt_pretty: true
          })
          return tasksByProject.data
        })
      )
      tasks = tasks.reduce((r, e) => (r.push(...e), r), [])

      let taskDetails = await Promise.all(
        tasks.map(async task => {
          const taskdetail = await client.tasks.getTask(task.gid, {
            opt_pretty: true
          })
          return taskdetail
        })
      )
      let subtaskDetails = await Promise.all(
        tasks.map(async task => {
          const taskdetail = await client.tasks.getSubtasksForTask(task.gid, {
            opt_pretty: true
          })
          return {
            subtasks: taskdetail.data,
            parent: task
          }
        })
      )
      subtaskDetails = subtaskDetails.filter(task => task.subtasks.length > 0)

      let taskCSV = await converter.json2csvAsync(taskDetails, {
        expandArrayObjects: true,
        unwindArrays : true
      })
      let subtaskCSV = await converter.json2csvAsync(subtaskDetails, {
        expandArrayObjects: true,
        unwindArrays : true
      })
      await createCSV(taskCSV, "tasks.csv")
      await createCSV(subtaskCSV, "subtasks.csv")
      return res.status(200).json({
        tasks: taskDetails,
        subtasks: subtaskDetails
      })
      // return res.status(200).json({
      //   projects: tasks
      // })
    } catch {
      return res.status(500).json({
        result: false
      })
    }
  }
}