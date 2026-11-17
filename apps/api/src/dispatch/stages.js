const assignmentNext = Object.freeze({ assigned: 'en_route', en_route: 'attending', attending: 'resolved', resolved: 'closed' });
const assignmentStages = Object.freeze({ assigned: 0, en_route: 1, attending: 2, resolved: 3, closed: 4 });

function aggregateStatus(assignments) {
  const minimum = Math.min(...assignments.map((item) => assignmentStages[item.status]));
  return Object.keys(assignmentStages).find((status) => assignmentStages[status] === minimum);
}

module.exports = { assignmentNext, assignmentStages, aggregateStatus };
