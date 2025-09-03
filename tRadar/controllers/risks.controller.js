const express = require('express'),
    router = express.Router(),
    service = require('../services/risks.service')

// Here, get req will look like http://localhost:PORT/api/risks/   
router.get('/', async (req, res) => {
    const risks = await service.getAllRisks()
    res.send(risks)
})

// Get filtered risks
router.get('/filtered', async (req, res) => {
    const min = parseInt(req.query.min)
    const max = parseInt(req.query.max)

    if(isNaN(min) || isNaN(max)){
        return res.status(400).json("Invalid min or max value")
    }

    const risks = await service.getFilteredRisks(min, max)

    if (!risks || risks.length === 0){
        res.status(404).json(`No risks found between severity ${min} and ${max}`)
    } 
    else{
        res.send(risks)
    }
});

// Get a risk by its ID
router.get('/:id', async (req, res) => {
    const risk = await service.getRiskByID(req.params.id)
    if (risk === undefined)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send(risk)
})

// Delete a risk
router.delete('/:id', async (req, res) => {
    const affectedRows = await service.deleteRisk(req.params.id)
    if (affectedRows === 0)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send('Deleted the risk successfully!')
})

// Add a risk
router.post('/', async (req, res) => {
    const affectedRows = await service.addOrEditRisk(req.body)
    res.status(201).send('Risk added successfully!')
})

// Update a risk
router.put('/:id', async (req, res) => {
    const affectedRows = await service.addOrEditRisk(req.body, req.params.id)
    if (affectedRows === 0)
        res.status(404).json('No Risk Found With The Given ID: ' + req.params.id)
    else
        res.send('Updated the risk successfully!')
})

module.exports = router; 