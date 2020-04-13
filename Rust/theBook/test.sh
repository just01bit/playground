#!/bin/sh
if [ "$X" -lt "0" ]
then 
    echo "X is less than zero"
fi
if [ "$X" -gt "0" ]
then 
    echo "X is more than zero"
fi
[ "$X" -le "0" ] && \
    echo "X is less than or equal to zero"
[ "$X" -ge "0" ] && \
    echo "X is more than or equal to zero"
[ "$X" = "0" ] && \
    echo "X is the string or number \"0\""

